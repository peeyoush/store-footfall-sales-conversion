from pathlib import Path
from uuid import uuid4
import csv

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.upload import UploadResponse
from app.services.databricks import get_job
from app.services.pipeline import start_upload_pipeline, get_upload_status
from app.services.snowflake import test_connection, get_upload_summary


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Store Footfall & Sales Analytics API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPECTED_FILES = {
    "stores.csv",
    "footfall.csv",
    "bills.csv",
}

REQUIRED_COLUMNS = {
    "stores.csv": {
        "store_id",
        "city",
        "format",
    },
    "footfall.csv": {
        "store_id",
        "trade_date",
        "hour",
        "counter_status",
        "footfall",
    },
    "bills.csv": {
        "bill_id",
        "store_id",
        "bill_ts",
        "items",
        "bill_amount",
    },
}


def validate_csv(path: Path, filename: str) -> int:
    with path.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)

        if not reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail=f"{filename}: missing header row.",
            )

        actual_columns = set(reader.fieldnames)
        missing = REQUIRED_COLUMNS[filename] - actual_columns

        if missing:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{filename}: missing columns: "
                    + ", ".join(sorted(missing))
                ),
            )

        return sum(1 for _ in reader)


@app.get("/")
def root():
    return {
        "service": "Store Footfall & Sales Analytics API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/databricks/health")
def databricks_health():
    try:
        job = get_job()

        return {
            "status": "ok",
            "job_id": job.get("job_id"),
            "job_name": job.get("settings", {}).get("name"),
            "message": "FastAPI successfully connected to Databricks.",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Databricks connection failed: {exc}",
        )


@app.get("/api/snowflake/health")
def snowflake_health():
    try:
        connected = test_connection()

        return {
            "status": "ok" if connected else "error",
            "message": (
                "FastAPI successfully connected to Snowflake."
                if connected
                else "Snowflake connection test failed."
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Snowflake connection failed: {exc}",
        )


@app.post("/api/upload", response_model=UploadResponse)
async def upload_files(
    stores: UploadFile = File(...),
    footfall: UploadFile = File(...),
    bills: UploadFile = File(...),
):
    uploaded = [stores, footfall, bills]

    filenames = {
        file.filename
        for file in uploaded
        if file.filename
    }

    if filenames != EXPECTED_FILES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload exactly these files: "
                "stores.csv, footfall.csv, bills.csv"
            ),
        )

    run_id = uuid4().hex
    run_dir = UPLOAD_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    files_map = {
        "stores.csv": stores,
        "footfall.csv": footfall,
        "bills.csv": bills,
    }

    saved_files = []
    row_counts = {}

    for filename, upload in files_map.items():
        destination = run_dir / filename

        content = await upload.read()
        destination.write_bytes(content)

        row_counts[filename] = validate_csv(
            destination,
            filename,
        )

        saved_files.append(filename)

    try:
        pipeline_run_id = start_upload_pipeline(
            run_id=run_id,
            local_upload_dir=run_dir,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Databricks processing could not be started: {exc}",
        )

    return UploadResponse(
        success=True,
        run_id=run_id,
        message="Files uploaded, validated, and Databricks processing started.",
        files=sorted(saved_files),
        rows=row_counts,
        pipeline_run_id=pipeline_run_id,
    )


@app.get("/api/upload/status/{run_id}/{pipeline_run_id}")
def upload_processing_status(
    run_id: str,
    pipeline_run_id: int,
):
    try:
        return get_upload_status(
            run_id=run_id,
            pipeline_run_id=pipeline_run_id,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve upload status: {exc}",
        )


@app.get("/api/upload/summary/{run_id}")
def upload_summary(run_id: str):
    try:
        return get_upload_summary(run_id)

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve uploaded data: {exc}",
        )