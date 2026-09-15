import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Guide
from app.utils.document_loader import extract_text_from_file, sanitize_text

settings = get_settings()


def summarize_guide_text(text: str) -> str:
    cleaned = sanitize_text(text)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return "\n".join(lines[:200])


def create_guide_record(db: Session, payload: dict, storage_path: str, file_name: str, original_text: str) -> Guide:
    summary = summarize_guide_text(original_text)
    guide = Guide(
        name=payload.get("name") or file_name,
        committee=payload.get("committee"),
        conference=payload.get("conference"),
        format=payload.get("format"),
        description=payload.get("description"),
        version=payload.get("version") or "1.0",
        status=payload.get("status") or "active",
        is_default=bool(payload.get("is_default")),
        file_name=file_name,
        storage_path=storage_path,
        original_text=original_text,
        summary_text=summary,
        metadata_json=json.dumps({
            "committee": payload.get("committee"),
            "conference": payload.get("conference"),
            "format": payload.get("format"),
            "description": payload.get("description"),
            "version": payload.get("version") or "1.0",
        })
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


def get_default_guide(db: Session) -> Guide | None:
    return db.query(Guide).filter(Guide.is_default.is_(True)).first() or db.query(Guide).first()


def find_relevant_guide(db: Session, committee: str | None = None, conference: str | None = None, format_name: str | None = None) -> Guide | None:
    query = db.query(Guide).filter(Guide.status == "active")
    if committee:
        exact = query.filter(Guide.committee.ilike(committee)).first()
        if exact:
            return exact
    if conference:
        exact = query.filter(Guide.conference.ilike(conference)).first()
        if exact:
            return exact
    if format_name:
        exact = query.filter(Guide.format.ilike(format_name)).first()
        if exact:
            return exact
    return get_default_guide(db)


def guide_to_context(guide: Guide) -> str:
    text = guide.summary_text or guide.original_text or ""
    return f"""
Guide Name: {guide.name}
Committee: {guide.committee or 'General'}
Conference: {guide.conference or 'N/A'}
Format: {guide.format or 'N/A'}
Description: {guide.description or 'N/A'}

Relevant requirements to follow:
{text}
""".strip()
