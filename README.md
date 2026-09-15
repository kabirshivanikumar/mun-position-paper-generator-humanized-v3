# MUN Position Paper Generator

An AI-powered Model United Nations position paper generator with an admin-managed knowledge layer and a simple delegate interface.

### Humanization + AI-detection layer (third-party APIs)
After the base paper is generated with Gemini, the system:

1. Sends the draft to **AIHumanizerAPI.com** (humanizer API) – up to **4 passes**.
2. After each pass, checks the AI probability with **Sapling** detector API.
3. Stops as soon as the score is **under 5%**.
4. If still ≥ 5% after 4 passes, returns the best version + the final score.

Required env vars (add to `backend/.env`):
```
HUMANIZER_API_KEY=your_key     # free 10,000 words/mo at https://aihumanizerapi.com
DETECTOR_API_KEY=your_key      # free 50k chars/day at https://sapling.ai
```

If either key is missing the system falls back to Gemini-based rewriting so the app still works.
Frontend shows live status updates during the longer multi-API process.
No existing generation logic was removed.

## Why Gemini

As of September 2026, Google Gemini's free tier remains a practical and cost-effective choice for this project:

- Free access to Gemini developer API models, with generous free usage for experimentation and low-volume prototypes.
- Good rate limits for small projects and early-stage apps.
- Strong multimodal and text generation quality.
- Large context windows suitable for guide + study guide + committee + delegation prompt assembly.
- Very easy API integration with the Python backend.

This project is configured to use a configurable provider via `AI_API_KEY` and `AI_MODEL`, with Google Gemini as the default choice because it currently offers the best balance of free usage, quality, rate limits, and ease of integration for a local MVP.

## Architecture

- Frontend: Next.js + React + TypeScript + Tailwind
- Backend: Python + FastAPI
- AI: Configurable provider, default Gemini
- Storage: SQLite via SQLAlchemy
- Document ingestion: PDF, DOCX, TXT parsing
- Retrieval: admin guide selection + contextual prompt construction
- Auth: basic admin authentication with env-based credentials

## Project structure

```text
mun-position-paper-generator/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── __init__.py
│   │   │   ├── provider.py
│   │   │   └── humanizer.py   # multi-pass humanize + AI-score loop
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── auth.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── generation_service.py
│   │   │   └── guide_service.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── document_loader.py
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── models.py
│   ├── .env.example
│   ├── app.db
│   ├── requirements.txt
│   └── uploads/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── next.config.ts
│   └── ...
├── .gitignore
├── README.md
└── docker-compose.yml
```

## Requirements

- Python 3.11+
- Node.js 20+
- npm

## Backend setup

```bash
cd backend
python -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Then update `.env` with your values:

```env
APP_ENV=development
SECRET_KEY=change-me
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
DATABASE_URL=sqlite:///./app.db
AI_API_KEY=your_key_here
AI_MODEL=gemini-2.5-flash
MAX_UPLOAD_SIZE_MB=10
ALLOWED_EXTENSIONS=.pdf,.docx,.txt
UPLOAD_DIR=uploads
```

Keep `backend/.env` local and uncommitted. Set `AI_API_KEY` to a newly rotated provider key and set `ADMIN_PASSWORD` to the admin password you want to use before starting the backend.

## Run backend

```bash
cd backend
. .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

```bash
cd frontend
npm install
```

Add `.env.local`:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## Run frontend

```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000`.

## Admin authentication

The backend uses HTTP Basic Auth for admin endpoints. Open `http://localhost:3000/admin` to sign in. The admin dashboard lets you upload, delete, and select position-paper guides, and edit the public homepage heading, intro copy, ticker, and popup without changing code. Blank content fields remove that text from the public page.

Set these values in your local `.env`:

- Username: `admin`
- Password: your local admin password

## Admin workflow

1. Upload one or more position paper guides from the admin side.
2. Store metadata like committee, conference, format, description.
3. Keep guides as the permanent rulebook used as guide context for generation.
4. The delegate only uploads a study guide and enters delegation + committee.

## Delegate workflow

1. Choose delegation and committee.
2. Upload the study guide PDF/DOCX/TXT.
3. Enter word count and any optional instructions.
4. Click generate.
5. Review final paper in the generated content area.

## AI generation flow

The backend separates each layer clearly:

- Admin Position Paper Guide = output requirements, formatting, structure, tone.
- Study Guide = issue/topic context.
- Delegation = country position.
- Committee = diplomacy and procedural context.
- User requirements = word count, additional instructions.

The AI prompt is assembled in layers, and the selected guide is treated as the authoritative formatting rulebook.

## Export roadmap

This MVP includes editable generated content in the UI and a backend foundation for export generation. PDF/DOCX/TXT export can be built as the next step using `reportlab` and `python-docx`.

## Deployment

### Local development

Run the backend and frontend separately as described above.

### Production deployment

Suggested approach:

- Deploy FastAPI backend to Render, Railway, or a VPS.
- Deploy Next.js frontend to Vercel.
- Use environment variables for secrets.
- Keep SQLite for small deployments; switch to Postgres for scale later.

## Notes

- The app is intentionally practical and lightweight.
- It does not fine-tune the underlying AI model.
- Instead, it uses a guide-driven RAG-style prompt system that keeps instruction materials separate from user inputs.
- Uploaded guides are never presented as user input; they are permanent admin knowledge.
