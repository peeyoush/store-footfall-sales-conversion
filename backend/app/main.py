from pathlib import Path
from uuid import uuid4
import csv

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.upload import UploadSessionResponse,FileUploadResponse,ProcessingResponse
from app.services.databricks import get_job
from app.services.pipeline import start_upload_pipeline, get_upload_status, create_upload_run, upload_single_file, get_uploaded_files, start_processing
from app.services.snowflake import test_connection, get_upload_summary,get_upload_rows

import tempfile

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

@app.post("/api/upload/start",response_model=UploadSessionResponse,)
def start_upload():
    run_id = uuid4().hex

    try:
        create_upload_run(run_id)

        return {
            "success": True,
            "run_id": run_id,
            "message": "Upload session created.",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not create upload session: {exc}",
        )

@app.post("/api/upload/{run_id}/file",response_model=FileUploadResponse,)
async def upload_single_csv(
    run_id: str,
    file: UploadFile = File(...),
):
    if len(run_id) != 32:
        raise HTTPException(
            status_code=400,
            detail="Invalid run_id.",
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    filename = file.filename

    if filename not in EXPECTED_FILES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid file. Expected one of: "
                "stores.csv, footfall.csv, bills.csv"
            ),
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".csv",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                temp_file.write(chunk)

        row_count = validate_csv(
            temp_path,
            filename,
        )

        result = upload_single_file(
            run_id=run_id,
            filename=filename,
            local_path=temp_path,
        )

        return {
            "success": True,
            "run_id": run_id,
            "filename": filename,
            "rows": row_count,
            "remote_path": result["remote_path"],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not upload {filename}: {exc}",
        )

    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

@app.post("/api/upload/{run_id}/process",response_model=ProcessingResponse,)
def process_uploaded_run(run_id: str):
    if len(run_id) != 32:
        raise HTTPException(
            status_code=400,
            detail="Invalid run_id.",
        )

    try:
        uploaded_files = get_uploaded_files(run_id)

        pipeline_run_id = start_processing(run_id)

        return {
            "success": True,
            "run_id": run_id,
            "files": sorted(uploaded_files),
            "pipeline_run_id": pipeline_run_id,
            "message": (
                "All required files are present. "
                "Databricks processing started."
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not start processing: {exc}",
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
@app.get("/api/upload/data/{run_id}")
def upload_data(run_id: str):
    try:
        rows = get_upload_rows(run_id)

        return {
            "run_id": run_id,
            "rows": rows,
            "row_count": len(rows),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve uploaded Gold data: {exc}",
        )