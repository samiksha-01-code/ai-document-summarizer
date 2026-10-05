from pathlib import Path
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from backend.services.file_handler import extract_content
from backend.services.summarizer import summarize_document, MODEL


router = APIRouter(
    prefix="/api/v1"
)


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
    ".csv"
}


@router.get("/health")
def health_check():

    return {
        "status": "ok",
        "service": "AI Document Summarizer"
    }


@router.get("/models")
def get_models():

    return {
        "model": MODEL,
        "supported_formats": [
            "pdf",
            "docx",
            "txt",
            "csv"
        ]
    }


@router.post("/documents/summarize")
async def summarize_uploaded_document(
    file: UploadFile = File(...)
):

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file format. "
                "Supported formats: PDF, DOCX, TXT, CSV."
            )
        )

    try:

        file_content = await file.read()

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            temp_file.write(file_content)

            temp_file_path = temp_file.name

        try:

            content = extract_content(
                temp_file_path
            )

            summary, chunks = summarize_document(
                content
            )

        finally:

            Path(temp_file_path).unlink(
                missing_ok=True
            )

        return {
            "filename": file.filename,
            "summary": summary,
            "chunks": chunks,
            "model": MODEL
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {str(e)}"
        )