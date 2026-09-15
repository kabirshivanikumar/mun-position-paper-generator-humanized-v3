from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database import Base


class Guide(Base):
    __tablename__ = "guides"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    committee = Column(String(255), nullable=True)
    conference = Column(String(255), nullable=True)
    format = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    version = Column(String(50), default="1.0")
    status = Column(String(50), default="active")
    is_default = Column(Boolean, default=False)
    file_name = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    original_text = Column(Text, nullable=True)
    summary_text = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeneratedPaper(Base):
    __tablename__ = "generated_papers"

    id = Column(Integer, primary_key=True, index=True)
    delegation = Column(String(255), nullable=False)
    committee = Column(String(255), nullable=False)
    topic = Column(String(255), nullable=True)
    word_count = Column(Integer, default=700)
    additional_instructions = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    source_guide_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SiteContent(Base):
    __tablename__ = "site_content"

    id = Column(Integer, primary_key=True, index=True)
    hero_title = Column(String(255), default="Position paper studio")
    hero_subtitle = Column(Text, default="A calm place to prepare delegate papers from your committee's own source material.")
    ticker_text = Column(String(500), default="Source-led writing workspace")
    popup_title = Column(String(255), default="Welcome to the studio")
    popup_body = Column(Text, default="Upload your committee materials and begin with a grounded first draft.")
    popup_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
