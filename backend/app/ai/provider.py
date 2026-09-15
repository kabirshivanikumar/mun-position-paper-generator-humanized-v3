import os
from typing import Any

import google.generativeai as genai

from app.config import get_settings

settings = get_settings()


def configure_ai() -> None:
    if settings.ai_api_key:
        genai.configure(api_key=settings.ai_api_key)


def generate_text(prompt: str, model_name: str | None = None) -> str:
    configure_ai()
    model = genai.GenerativeModel(model_name or settings.ai_model)
    try:
        response = model.generate_content(prompt)
    except Exception as exc:
        raise RuntimeError(f"AI provider request failed: {exc}") from exc
    return getattr(response, "text", "") or ""


def build_generation_prompt(guide_context: str, study_guide_text: str, delegation: str, committee: str, user_input: dict[str, Any]) -> str:
    word_count = user_input.get("word_count") or 700
    topic = user_input.get("topic") or ""
    instructions = user_input.get("additional_instructions") or ""

    return f"""
You are generating a Model United Nations position paper.

SYSTEM ROLE:
The ADMIN POSITION PAPER GUIDE defines the required structure, formatting, style, and requirements. Follow it precisely.
The STUDY GUIDE defines the issue being discussed.
The DELEGATION defines the country whose position you are representing.
The COMMITTEE defines the diplomatic context.

CRITICAL RULES:
- Write an ORIGINAL position paper. Do not copy language from the reference guide.
- Follow the guide exactly on required sections, formatting, tone, word count, and paragraph organization.
- Keep factual claims grounded in reliable information and avoid inventing policies, treaties, statistics, laws, quotes, or historical events.
- If a factual issue is uncertain, do not fabricate; state it carefully or avoid it.
- Separate factual background from proposed solutions.
- The output should be aimed at the selected delegation and committee.
- Do not add headings or sections that are not authorized by the guide unless the guide requires them.
- Use clear, plain language that a well-prepared student delegate would naturally use.
- Prefer familiar words and concrete verbs over inflated or overly academic wording.
- Keep sentences varied and readable; avoid repetitive sentence openings, filler, and generic claims.
- Do not use buzzwords, clichés, excessive hedging, or artificial-sounding transitions.
- Make each paragraph advance a specific argument, fact, or policy proposal.

GUIDE CONTEXT:
{guide_context}

STUDY GUIDE CONTEXT:
{study_guide_text}

USER CONTEXT:
- Delegation: {delegation}
- Committee: {committee}
- Topic: {topic}
- Word count target: {word_count}
- Additional instructions: {instructions}

OUTPUT REQUIREMENTS:
- Produce a final paper only, with no preamble and no explanation about the process.
- Match the required style, section ordering, and format from the guide.
- Ensure the final output is approximately {word_count} words unless the guide states otherwise.
- Keep the writing diplomatic, analytical, and policy-oriented.
""".strip()
