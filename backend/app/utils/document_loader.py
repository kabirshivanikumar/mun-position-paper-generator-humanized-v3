import os
import re
from pathlib import Path

import docx
from PyPDF2 import PdfReader


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def sanitize_text(text: str) -> str:
    text = text.replace("\u0000", "")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")

    if suffix == ".pdf":
        reader = PdfReader(str(path))
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text)
        return sanitize_text("\n\n".join(pages))

    if suffix == ".docx":
        document = docx.Document(str(path))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        return sanitize_text("\n\n".join(paragraphs))

    if suffix == ".txt":
        return sanitize_text(path.read_text(encoding="utf-8", errors="ignore"))

    raise ValueError(f"Could not extract text from {file_path}")


def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    if not text:
        return []

    text = sanitize_text(text)
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def validate_upload(file_name: str, file_size: int, max_mb: int = 10) -> None:
    suffix = Path(file_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type. allowed: .pdf, .docx, .txt")

    max_bytes = max_mb * 1024 * 1024
    if file_size > max_bytes:
        raise ValueError(f"File too large. Max {max_mb}MB")
