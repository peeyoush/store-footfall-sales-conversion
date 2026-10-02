from pathlib import Path

from .databricks import (
    create_directory,
    upload_file,
    run_upload_job,
    get_run_status,
    download_file,
    list_directory,
)

from .snowflake import (
    upload_file_to_stage,
    copy_uploaded_gold,
)


DATABRICKS_UPLOAD_ROOT = (
    "/Volumes/workspace/capstone_peeyoush/raw/uploads"
)

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"

EXPECTED_FILES = (
    "stores.csv",
    "footfall.csv",
    "bills.csv",
)


def create_upload_run(run_id: str):
    remote_root = f"{DATABRICKS_UPLOAD_ROOT}/{run_id}"

    create_directory(remote_root + "/")

    return remote_root


def upload_single_file(
    run_id: str,
    filename: str,
    local_path: Path,
):
    if filename not in EXPECTED_FILES:
        raise ValueError(f"Unexpected upload file: {filename}")

    remote_root = f"{DATABRICKS_UPLOAD_ROOT}/{run_id}"
    remote_path = f"{remote_root}/{filename}"

    upload_file(
        str(local_path),
        remote_path,
    )

    return {
        "filename": filename,
        "run_id": run_id,
        "remote_path": remote_path,
    }


def get_uploaded_files(run_id: str):
    remote_root = f"{DATABRICKS_UPLOAD_ROOT}/{run_id}"

    data = list_directory(remote_root)

    contents = data.get("contents", [])

    return [
        item["name"]
        for item in contents
        if not item.get("is_directory", False)
    ]


def start_processing(run_id: str):
    uploaded_files = set(get_uploaded_files(run_id))
    required_files = set(EXPECTED_FILES)

    missing_files = sorted(required_files - uploaded_files)

    if missing_files:
        raise ValueError(
            "Cannot start processing. Missing files: "
            + ", ".join(missing_files)
        )

    job_response = run_upload_job(run_id)

    return int(job_response["run_id"])


def start_upload_pipeline(
    run_id: str,
    local_upload_dir: Path,
) -> int:
    create_upload_run(run_id)

    for filename in EXPECTED_FILES:
        upload_single_file(
            run_id=run_id,
            filename=filename,
            local_path=local_upload_dir / filename,
        )

    return start_processing(run_id)


def finalize_upload_pipeline(
    run_id: str,
    pipeline_run_id: int,
):
    status = get_run_status(pipeline_run_id)

    if status["life_cycle_state"] != "TERMINATED":
        return {
            "status": "processing",
            "databricks": status,
        }

    if status["result_state"] != "SUCCESS":
        raise RuntimeError(
            f"Databricks processing failed: {status}"
        )

    local_path = (
        UPLOAD_DIR
        / run_id
        / "GOLD_STORE_HOUR_FROM_DATABRICKS.csv"
    )

    if not local_path.exists():
        local_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        remote_path = (
            f"{DATABRICKS_UPLOAD_ROOT}/"
            f"{run_id}/GOLD_STORE_HOUR.csv"
        )

        download_file(
            remote_path,
            local_path,
        )

    stage_result = upload_file_to_stage(
        run_id=run_id,
        local_path=local_path,
    )

    copy_result = copy_uploaded_gold(run_id)

    return {
        "status": "completed",
        "run_id": run_id,
        "pipeline_run_id": pipeline_run_id,
        "databricks": status,
        "snowflake_stage": stage_result,
        "snowflake_copy": copy_result,
    }


def get_upload_status(
    run_id: str,
    pipeline_run_id: int,
):
    status = get_run_status(pipeline_run_id)

    if (
        status["life_cycle_state"] == "TERMINATED"
        and status["result_state"] == "SUCCESS"
    ):
        return finalize_upload_pipeline(
            run_id=run_id,
            pipeline_run_id=pipeline_run_id,
        )

    if status["result_state"] == "FAILED":
        return {
            "status": "failed",
            "run_id": run_id,
            "pipeline_run_id": pipeline_run_id,
            "databricks": status,
        }

    return {
        "status": "processing",
        "run_id": run_id,
        "pipeline_run_id": pipeline_run_id,
        "databricks": status,
    }