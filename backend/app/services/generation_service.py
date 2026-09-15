from sqlalchemy.orm import Session

from app.ai.provider import build_generation_prompt, generate_text
from app.ai.humanizer import humanize_text
from app.models import GeneratedPaper
from app.services.guide_service import find_relevant_guide, guide_to_context


def infer_topic_from_study_guide(study_guide_text: str) -> str:
    text = study_guide_text.strip()
    if len(text) <= 200:
        return text[:120]
    sentences = text.split(".")
    relevant = []
    for sentence in sentences:
        cleaned = sentence.strip()
        if len(cleaned) > 20:
            relevant.append(cleaned)
            if len(relevant) >= 2:
                break
    return " ".join(relevant)[:200]


def generate_position_paper(db: Session, payload: dict) -> GeneratedPaper:
    delegation = payload.get("delegation") or "United Nations"
    committee = payload.get("committee") or "General Assembly"
    study_guide_text = payload.get("study_guide_text") or ""
    word_count = int(payload.get("word_count") or 700)
    additional_instructions = payload.get("additional_instructions") or ""

    guide = find_relevant_guide(db, committee=committee)
    guide_context = guide_to_context(guide) if guide else "No specific guide found. Use general MUN best practices for diplomatic writing."

    prompt = build_generation_prompt(
        guide_context=guide_context,
        study_guide_text=study_guide_text,
        delegation=delegation,
        committee=committee,
        user_input={
            "word_count": word_count,
            "topic": infer_topic_from_study_guide(study_guide_text),
            "additional_instructions": additional_instructions,
        },
    )
    # Step 1: Generate the base paper (original logic untouched)
    content = generate_text(prompt)

    # Step 2: Third-party humanize (up to 4 passes) + detector loop
    # Stops early once AI score is under 5%
    humanized = humanize_text(content)  # uses HUMANIZER_MAX_PASSES & TARGET_AI_SCORE from settings
    final_content = humanized["content"]
    ai_score = humanized["ai_score"]

    paper = GeneratedPaper(
        delegation=delegation,
        committee=committee,
        topic=infer_topic_from_study_guide(study_guide_text),
        word_count=word_count,
        additional_instructions=additional_instructions,
        content=final_content,
        source_guide_id=guide.id if guide else None,
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # Attach humanization metadata so the API can return it
    # (does not change the DB schema)
    paper._ai_score = ai_score  # type: ignore[attr-defined]
    paper._humanize_passes = humanized["passes"]  # type: ignore[attr-defined]
    paper._score_history = humanized["history"]  # type: ignore[attr-defined]
    paper._provider = humanized.get("provider", "unknown")  # type: ignore[attr-defined]

    return paper
