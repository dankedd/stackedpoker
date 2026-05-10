# Stacked Poker

Premium AI-powered poker hand analysis with GTO-inspired coaching.  
Upload a screenshot or paste a hand history — get instant solver-inspired feedback.

---

## Architecture

| Layer | Service |
|-------|---------|
| Frontend | Vercel (Next.js 15) |
| Backend | Railway / Render (FastAPI) |
| Auth & Database | Supabase |
| AI | OpenAI API (gpt-4o) |

---

## Project Structure

```
stacked-poker/
├── frontend/                 # Next.js 15 app (deploy to Vercel)
│   ├── app/                  # App Router pages
│   ├── components/           # UI + poker replay components
│   ├── hooks/                # useReplay, useAnalysis
│   ├── lib/                  # api.ts, types.ts, utils.ts
│   ├── .env.example          # Required environment variables
│   └── vercel.json           # Vercel build config
├── backend/                  # FastAPI Python API (deploy to Railway/Render)
│   ├── app/
│   │   ├── api/routes/       # /extract-hand, /confirm-hand, /analyze, /health
│   │   ├── services/         # vision_coach, hand_reconstructor, position_engine
│   │   ├── models/           # Pydantic schemas
│   │   └── config.py         # Settings (pydantic-settings)
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── supabase_schema.sql        # Run once in Supabase SQL editor
├── docker-compose.yml         # Local full-stack dev
└── sample_hands/              # Example hand histories for testing
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase account (free tier works)
- OpenAI API key

### 1 · Clone

```bash
git clone https://github.com/dankedd/stackedpoker.git
cd stackedpoker
```

### 2 · Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — fill in OPENAI_API_KEY, SUPABASE_* values

# Start API server
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### 3 · Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local — fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Start dev server
npm run dev
```

Frontend available at `http://localhost:3000`

### 4 · Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase_schema.sql`
3. Copy your project URL and anon key from **Project Settings → API**

---

## Environment Variables

### Frontend — `frontend/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

### Backend — `backend/.env`

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (required for AI coaching) |
| `OPENAI_VISION_MODEL` | Vision model — default `gpt-4o` |
| `OPENAI_MODEL` | Text model — default `gpt-4o-mini` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (for auth verification) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `DEBUG` | `true` / `false` |

---

## Deployment

### Frontend → Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. In project settings, set **Root Directory** to `frontend`
4. Add all environment variables from `frontend/.env.example`
5. Deploy — Vercel auto-detects Next.js

**Required Vercel environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL   ← set to your Railway/Render backend URL
```

### Backend → Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Select the repo, set **Root Directory** to `backend`
3. Railway auto-detects the `Dockerfile`
4. Add environment variables from `backend/.env.example`
5. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Required Railway environment variables:**
```
OPENAI_API_KEY
OPENAI_VISION_MODEL=gpt-4o
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

### Backend → Render (alternative)

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect repo, set **Root Directory** to `backend`
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/extract-hand` | Phase 1: extract poker state from screenshot |
| `POST` | `/api/confirm-hand` | Phase 2: coaching from confirmed state |
| `POST` | `/api/analyze` | Full text-based hand analysis pipeline |
| `POST` | `/api/parse` | Parse hand history only (no AI) |

---

## How It Works

### Screenshot → Coaching Pipeline

1. **Upload** — User uploads a poker screenshot
2. **Extract** — GPT-4o Vision identifies players, positions, cards, actions, pot
3. **Confirm** — User reviews and corrects the extracted data
4. **Coach** — GPT-4o evaluates hero's decisions and provides GTO feedback
5. **Replay** — Animated hand replay with per-action coaching cards

### Position Engine

Deterministic clockwise position assignment for 2–9 player tables.  
Supports anchor-based inference: if BTN/SB/BB is detected, all other positions are computed cyclically.

### Money Normalization

All amounts are converted to big blinds using parsed stakes (`$0.01/$0.02` → BB = 0.02).  
`$1.23` at `$0.01/$0.02` → `61.5bb`. Display strings include both: `"$1.23 (61.5bb)"`.

---

## Docker (full-stack local)

```bash
# Requires Docker Desktop
OPENAI_API_KEY=sk-... docker-compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`

---

## Notes

- **No real solver** — Heuristics are GTO-inspired educational approximations
- **AI fallback** — If no OpenAI key is set, a static coaching summary is returned
- **DB is optional** — The API works without Postgres; persistence is best-effort
- **OCR optional** — Install `easyocr` and `opencv-python-headless` to enable screenshot OCR enhancement
