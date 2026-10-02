from pydantic import BaseModel


class UploadSessionResponse(BaseModel):
    success: bool
    run_id: str
    message: str


class FileUploadResponse(BaseModel):
    success: bool
    run_id: str
    filename: str
    rows: int
    remote_path: str


class ProcessingResponse(BaseModel):
    success: bool
    run_id: str
    files: list[str]
    pipeline_run_id: int
    message: str