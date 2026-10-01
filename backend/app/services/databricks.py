import os
from urllib.parse import quote
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "").rstrip("/")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_JOB_ID = os.getenv("DATABRICKS_JOB_ID", "")

if not DATABRICKS_HOST:
    raise RuntimeError("DATABRICKS_HOST is missing")

if not DATABRICKS_TOKEN:
    raise RuntimeError("DATABRICKS_TOKEN is missing")

if not DATABRICKS_JOB_ID:
    raise RuntimeError("DATABRICKS_JOB_ID is missing")

HEADERS = {
    "Authorization": f"Bearer {DATABRICKS_TOKEN}",
}


def get_job():
    response = requests.get(
        f"{DATABRICKS_HOST}/api/2.2/jobs/get",
        params={"job_id": int(DATABRICKS_JOB_ID)},
        headers=HEADERS,
        timeout=30,
    )

    response.raise_for_status()
    return response.json()


def create_directory(directory_path: str):
    encoded_path = quote(directory_path, safe="/")

    response = requests.put(
        f"{DATABRICKS_HOST}/api/2.0/fs/directories{encoded_path}",
        headers=HEADERS,
        timeout=60,
    )

    response.raise_for_status()


def upload_file(local_path: str, remote_path: str):
    encoded_path = quote(remote_path, safe="/")

    with open(local_path, "rb") as file:
        response = requests.put(
            f"{DATABRICKS_HOST}/api/2.0/fs/files{encoded_path}",
            params={"overwrite": "true"},
            headers={
                **HEADERS,
                "Content-Type": "application/octet-stream",
            },
            data=file,
            timeout=120,
        )

    response.raise_for_status()


def run_upload_job(run_id: str):
    response = requests.post(
        f"{DATABRICKS_HOST}/api/2.2/jobs/run-now",
        headers={
            **HEADERS,
            "Content-Type": "application/json",
        },
        json={
            "job_id": int(DATABRICKS_JOB_ID),
            "job_parameters": {
                "run_id": run_id
            },
            "idempotency_token": run_id,
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()


def get_run_status(run_id: int):
    response = requests.get(
        f"{DATABRICKS_HOST}/api/2.2/jobs/runs/list",
        params={
            "job_id": int(DATABRICKS_JOB_ID),
            "limit": 25,
        },
        headers=HEADERS,
        timeout=30,
    )

    response.raise_for_status()

    runs = response.json().get("runs", [])

    target_id = int(run_id)

    for run in runs:
        if int(run["run_id"]) == target_id:
            state = run.get("state", {})

            return {
                "run_id": run["run_id"],
                "life_cycle_state": state.get("life_cycle_state"),
                "result_state": state.get("result_state"),
                "state_message": state.get("state_message"),
            }

    raise ValueError(f"Databricks run {run_id} was not found.")


def download_file(remote_path: str, local_path: Path):
    encoded_path = quote(remote_path, safe="/")

    response = requests.get(
        f"{DATABRICKS_HOST}/api/2.0/fs/files{encoded_path}",
        headers=HEADERS,
        timeout=120,
    )

    response.raise_for_status()
    local_path.write_bytes(response.content)

    return local_path