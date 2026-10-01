from pydantic import BaseModel


class UploadResponse(BaseModel):
    success: bool
    run_id: str
    message: str
    files: list[str]
    rows: dict[str, int]
    pipeline_run_id: int | None = None