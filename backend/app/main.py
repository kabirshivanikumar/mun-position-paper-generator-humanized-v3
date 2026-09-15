from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import GeneratedPaper, Guide, SiteContent
from app.routers import auth
from app.routers.auth import admin_auth
from app.services.generation_service import generate_position_paper
from app.services.guide_service import create_guide_record, find_relevant_guide, get_default_guide
from app.utils.document_loader import extract_text_from_file, validate_upload

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MUN Position Paper Generator", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


def content_payload(content: SiteContent) -> dict:
    return {
        "hero_title": content.hero_title,
        "hero_subtitle": content.hero_subtitle,
        "ticker_text": content.ticker_text,
        "popup_title": content.popup_title,
        "popup_body": content.popup_body,
        "popup_enabled": content.popup_enabled,
    }


def get_or_create_site_content(db: Session) -> SiteContent:
    content = db.query(SiteContent).first()
    if not content:
        content = SiteContent()
        db.add(content)
        db.commit()
        db.refresh(content)
    return content


@app.get("/api/site-content")
def get_site_content(db: Session = Depends(get_db)):
    return content_payload(get_or_create_site_content(db))


@app.get("/api/admin/summary")
def get_admin_summary(_: str = Depends(admin_auth), db: Session = Depends(get_db)):
    guides = db.query(Guide).all()
    return {
        "active_guides": len(guides),
        "default_guide": get_default_guide(db).name if get_default_guide(db) else None,
        "guides": [
            {
                "id": guide.id,
                "name": guide.name,
                "committee": guide.committee,
                "conference": guide.conference,
                "format": guide.format,
                "status": guide.status,
                "version": guide.version,
                "created_at": guide.created_at.isoformat() if guide.created_at else None,
            }
            for guide in guides
        ],
    }


@app.get("/api/guides")
def list_guides(db: Session = Depends(get_db)):
    guides = db.query(Guide).all()
    return [{
        "id": guide.id,
        "name": guide.name,
        "committee": guide.committee,
        "conference": guide.conference,
        "format": guide.format,
        "description": guide.description,
        "status": guide.status,
        "version": guide.version,
        "is_default": guide.is_default,
        "created_at": guide.created_at.isoformat() if guide.created_at else None,
    } for guide in guides]


@app.post("/api/admin/guides")
async def upload_guide(
    name: str = Form(...),
    committee: str = Form(""),
    conference: str = Form(""),
    format_name: str = Form(""),
    description: str = Form(""),
    version: str = Form("1.0"),
    status: str = Form("active"),
    is_default: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
):
    validate_upload(file.filename or "", file.size or 0, settings.max_upload_size_mb)

    upload_dir = settings.upload_root
    upload_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{file.filename or 'guide'}"
    storage_path = upload_dir / storage_name
    contents = await file.read()
    storage_path.write_bytes(contents)

    original_text = extract_text_from_file(str(storage_path))
    payload = {
        "name": name,
        "committee": committee,
        "conference": conference,
        "format": format_name,
        "description": description,
        "version": version,
        "status": status,
        "is_default": is_default,
    }
    guide = create_guide_record(db, payload, str(storage_path), file.filename or "guide", original_text)
    return {"message": "Guide uploaded successfully", "guide": {"id": guide.id, "name": guide.name}}


@app.delete("/api/admin/guides/{guide_id}")
def delete_guide(guide_id: int, _: str = Depends(admin_auth), db: Session = Depends(get_db)):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    db.delete(guide)
    db.commit()
    return {"message": "Guide deleted"}


@app.put("/api/admin/guides/{guide_id}/default")
def set_default_guide(guide_id: int, _: str = Depends(admin_auth), db: Session = Depends(get_db)):
    for item in db.query(Guide).all():
        item.is_default = item.id == guide_id
    db.commit()
    return {"message": "Default guide updated"}


@app.get("/api/admin/guides/{guide_id}")
def get_guide(guide_id: int, _: str = Depends(admin_auth), db: Session = Depends(get_db)):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return {
        "id": guide.id,
        "name": guide.name,
        "committee": guide.committee,
        "conference": guide.conference,
        "format": guide.format,
        "description": guide.description,
        "status": guide.status,
        "version": guide.version,
        "is_default": guide.is_default,
        "summary": guide.summary_text,
    }


@app.put("/api/admin/site-content")
def update_site_content(payload: dict, _: str = Depends(admin_auth), db: Session = Depends(get_db)):
    content = get_or_create_site_content(db)
    for field in ("hero_title", "hero_subtitle", "ticker_text", "popup_title", "popup_body"):
        if field in payload:
            setattr(content, field, str(payload[field]))
    if "popup_enabled" in payload:
        content.popup_enabled = bool(payload["popup_enabled"])
    db.commit()
    db.refresh(content)
    return content_payload(content)


@app.post("/api/generate")
def generate_paper(payload: dict, db: Session = Depends(get_db)):
    delegation = payload.get("delegation")
    committee = payload.get("committee")
    study_guide_text = payload.get("study_guide_text")
    if not delegation or not committee or not study_guide_text:
        raise HTTPException(status_code=400, detail="delegation, committee, and study guide text are required")

    try:
        paper = generate_position_paper(db, payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "id": paper.id,
        "delegation": paper.delegation,
        "committee": paper.committee,
        "topic": paper.topic,
        "word_count": paper.word_count,
        "content": paper.content,
        "ai_score": getattr(paper, "_ai_score", None),
        "humanize_passes": getattr(paper, "_humanize_passes", 0),
        "score_history": getattr(paper, "_score_history", []),
        "provider": getattr(paper, "_provider", None),
    }


@app.post("/api/generate-from-upload")
async def generate_paper_from_upload(
    delegation: str = Form(...),
    committee: str = Form(...),
    word_count: int = Form(700),
    topic: str = Form(""),
    additional_instructions: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    validate_upload(file.filename or "", file.size or 0, settings.max_upload_size_mb)
    upload_dir = settings.upload_root
    upload_dir.mkdir(parents=True, exist_ok=True)
    storage_path = upload_dir / (file.filename or "study-guide.txt")
    contents = await file.read()
    storage_path.write_bytes(contents)
    study_guide_text = extract_text_from_file(str(storage_path))

    try:
        paper = generate_position_paper(db, {
            "delegation": delegation,
            "committee": committee,
            "study_guide_text": study_guide_text,
            "word_count": word_count,
            "topic": topic,
            "additional_instructions": additional_instructions,
        })
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "id": paper.id,
        "content": paper.content,
        "ai_score": getattr(paper, "_ai_score", None),
        "humanize_passes": getattr(paper, "_humanize_passes", 0),
        "score_history": getattr(paper, "_score_history", []),
        "provider": getattr(paper, "_provider", None),
    }


@app.get("/api/papers")
def list_papers(db: Session = Depends(get_db)):
    papers = db.query(GeneratedPaper).order_by(GeneratedPaper.created_at.desc()).all()
    return [{
        "id": paper.id,
        "delegation": paper.delegation,
        "committee": paper.committee,
        "topic": paper.topic,
        "word_count": paper.word_count,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
    } for paper in papers]


@app.get("/api/papers/{paper_id}")
def get_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(GeneratedPaper).filter(GeneratedPaper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return {
        "id": paper.id,
        "delegation": paper.delegation,
        "committee": paper.committee,
        "topic": paper.topic,
        "word_count": paper.word_count,
        "additional_instructions": paper.additional_instructions,
        "content": paper.content,
    }
