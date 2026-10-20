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

## Ad Attribution (sign-ups per ad)

Every new account stores the first `utm_*` set of the visit in `auth.users.raw_user_meta_data -> 'signup_utm'`
(email sign-ups at signup, Google sign-ups on their first page). Meta ads put the ad name in `utm_content`.
Run this in the Supabase SQL editor to see sign-ups per ad since the campaign start (12 October 2026):

```sql
SELECT
  COALESCE(raw_user_meta_data -> 'signup_utm' ->> 'utm_content', '(no utm)') AS ad,
  raw_user_meta_data -> 'signup_utm' ->> 'utm_campaign'                       AS campaign,
  COUNT(*)                                                                    AS signups,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL)                      AS confirmed
FROM auth.users
WHERE created_at >= TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Amsterdam'
GROUP BY 1, 2
ORDER BY signups DESC;
```

`confirmed` counts accounts whose email is verified (Google accounts are verified at once).

Sign-ups per trainer prompt (`signup_source`: `trainer_prompt_5`, `trainer_prompt_20`, `trainer_banner`;
empty for sign-ups that did not come through the trainer's save-progress prompt) and per ad:

```sql
SELECT
  COALESCE(raw_user_meta_data ->> 'signup_source', '(other)')                 AS source,
  COALESCE(raw_user_meta_data -> 'signup_utm' ->> 'utm_content', '(no utm)') AS ad,
  COUNT(*)                                                                    AS signups,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL)                      AS confirmed
FROM auth.users
WHERE created_at >= TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Amsterdam'
GROUP BY 1, 2
ORDER BY signups DESC;
```
Visitors who declined cookies are still counted here: the UTM data is first-party and does not depend on the Meta Pixel.

## Flop Equity Trainer

`/flop-trainer` (trainer), `/flop-trainer/quick-fire`, `/flop-trainer/explorer` (Pro). Ranges and Equity
Buckets come from Modern Poker Theory (`data/mpt/`); every flop is precomputed offline
(`backend/app/flop_equity`, `python -m app.flop_equity.precompute` then `… .load`) into `flop_equity`.
Migrations, in order: `supabase_flop_equity.sql`, `supabase_flop_trainer.sql`, `supabase_flop_trainer_phase3.sql`.
SQL tests: `bash supabase/tests/run_flop_trainer.sh`.

Answers count toward the Free plan's 50 trainer actions a day (shared with the Preflop Trainer). Every
answer is stored in `flop_trainer_answers` (quick fire: `flop_versus_answers`); XP goes through
`xp_events` with `source_type = 'flop_equity'`.

**Leak of the week** — the board types players misjudged most in the last 7 days (`bias` > 0: players
overrate the raiser's equity; < 0: they underrate it):

```sql
SELECT
  category                                                          AS board_type,
  COUNT(*)                                                          AS answers,
  COUNT(DISTINCT user_id)                                           AS players,
  ROUND(AVG(abs_error), 1)                                          AS avg_off,
  ROUND(AVG(guess_equity - actual_equity), 1)                       AS bias,
  ROUND(100.0 * AVG((abs_error <= 7)::int), 1)                      AS within_7_pct,
  ROUND(100.0 * AVG((nut_guess = nut_actual)::int), 1)              AS nut_right_pct,
  ROUND(100.0 * AVG(cbet_size_ok::int), 1)                          AS cbet_size_right_pct,
  ROUND(100.0 * AVG(cbet_band_ok::int), 1)                          AS cbet_freq_right_pct
FROM public.flop_trainer_answers
WHERE created_at >= now() - interval '7 days'
GROUP BY category
HAVING COUNT(*) >= 20
ORDER BY avg_off DESC;
```

And the single flops behind it:

```sql
SELECT
  spot_id, flop,
  COUNT(*)                                          AS answers,
  ROUND(AVG(actual_equity), 1)                      AS real_equity,
  ROUND(AVG(guess_equity), 1)                       AS avg_guess,
  ROUND(AVG(abs_error), 1)                          AS avg_off
FROM public.flop_trainer_answers
WHERE created_at >= now() - interval '7 days'
GROUP BY spot_id, flop
HAVING COUNT(*) >= 5
ORDER BY avg_off DESC
LIMIT 10;
```

**Usage per day** (last 30 Amsterdam days): flop trainer users (both modes), their accuracy on the equity
question, and the share that also used the Preflop Trainer that day (a preflop day = at least one XP
award, so a day of only wrong preflop answers is not counted):

```sql
WITH flop AS (
  SELECT (created_at AT TIME ZONE 'Europe/Amsterdam')::date AS day, user_id, abs_error
  FROM public.flop_trainer_answers
  UNION ALL
  SELECT (created_at AT TIME ZONE 'Europe/Amsterdam')::date, user_id, NULL
  FROM public.flop_versus_answers
),
preflop AS (
  SELECT DISTINCT (earned_at AT TIME ZONE 'Europe/Amsterdam')::date AS day, user_id
  FROM public.xp_events
  WHERE source_type = 'preflop_trainer'
),
per_user AS (
  SELECT f.day, f.user_id,
         AVG(f.abs_error)                                           AS avg_off,
         AVG((f.abs_error <= 7)::int) FILTER (WHERE f.abs_error IS NOT NULL) AS hit,
         bool_or(p.user_id IS NOT NULL)                             AS also_preflop
  FROM flop f
  LEFT JOIN preflop p ON p.day = f.day AND p.user_id = f.user_id
  GROUP BY f.day, f.user_id
)
SELECT day,
       COUNT(*)                                                     AS flop_trainer_users,
       ROUND(AVG(avg_off), 1)                                       AS avg_off,
       ROUND(100 * AVG(hit), 1)                                     AS within_7_pct,
       ROUND(100.0 * AVG(also_preflop::int), 1)                     AS also_preflop_pct
FROM per_user
WHERE day >= (now() AT TIME ZONE 'Europe/Amsterdam')::date - 30
GROUP BY day
ORDER BY day DESC;
```

Meta Pixel events (behind cookie consent): `FlopTrainerStart`, `FlopTrainerComplete`, `FlopQuickFireStart`,
`ExplorerOpen`, `PaywallView` (`source: flop_explorer`), `FlopTrainThisTexture`.

## Subscriptions (Free / Pro)

One paid plan: **Pro, €7.99/month incl. VAT**. New accounts get 7 days of Pro (reverse trial, no card).
Everything lives in `supabase_subscriptions.sql`:

| Free limit | Value (`plan_limits`) | Enforced by |
|---|---|---|
| Preflop Trainer | 50 answered hands / Amsterdam day | `consume_usage` in `POST /api/preflop-trainer/hands` |
| Hand Review | 1 new tournament / rolling 7 days; history shows the latest tournament | trigger + RLS on `hh_tournaments` / `hh_hands` |
| AI Coach | 3 questions / Amsterdam day (Pro & trial: hidden fair-use cap 100) | `consume_usage` in the coach endpoints |

Change a limit with `UPDATE public.plan_limits SET value = … WHERE key = '…';` — no deploy needed.
Subscription state is written only by the Stripe webhook (`subscriptions`, idempotent via `stripe_events`).
SQL tests: `bash supabase/tests/run.sh` (throwaway Postgres in Docker).

Upgrades per upgrade moment (`hand_limit`, `upload_limit`, `ai_limit`, `trial_ending`, `trial_ended`, `pricing_page`, `flop_explorer`):

```sql
SELECT
  COALESCE(upgrade_source, '(unknown)')                                       AS source,
  COUNT(*)                                                                    AS upgrades,
  COUNT(*) FILTER (WHERE status IN ('active', 'trialing', 'past_due'))        AS still_paying
FROM public.subscriptions
WHERE stripe_subscription_id IS NOT NULL
GROUP BY 1
ORDER BY upgrades DESC;
```

Trial → paid conversion per signup week (trials that have ended; "paid" = ever started a subscription):

```sql
SELECT
  date_trunc('week', created_at AT TIME ZONE 'Europe/Amsterdam')::date        AS signup_week,
  COUNT(*)                                                                    AS trials_ended,
  COUNT(*) FILTER (WHERE stripe_subscription_id IS NOT NULL)                  AS paid,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stripe_subscription_id IS NOT NULL)
        / NULLIF(COUNT(*), 0), 1)                                             AS conversion_pct
FROM public.subscriptions
WHERE trial_ends_at IS NOT NULL
  AND trial_ends_at <= now()
GROUP BY 1
ORDER BY 1 DESC;
```

## Hand Review: requested sites (files we couldn't import)

Every uploaded file the importer rejects is logged in `hh_unsupported_files`
(`supabase_hand_history_unsupported.sql`): the recognised site, the game type, the reason and
the file extension, never the file name or contents. Which sites and game types do players ask for?

```sql
SELECT
  COALESCE(site, '(not recognised)') AS site,
  game_type,
  reason,
  COUNT(*)                AS files,
  COUNT(DISTINCT user_id) AS players,
  MAX(created_at)         AS last_seen
FROM public.hh_unsupported_files
GROUP BY 1, 2, 3
ORDER BY players DESC, files DESC;
```

`reason`: `unsupported_site` (e.g. 888poker, iPoker), `cash` (cash game from a supported site),
`language` (PokerStars client not in English), `unrecognised`, `file_type` (e.g. a .pdf).

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
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint `/api/stripe/webhook` |
| `STRIPE_PRO_PRICE_ID` | The Pro price (€7.99/month, tax-inclusive) |

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
NEXT_PUBLIC_SITE_URL  ← https://stackedpokerai.com (the ONLY canonical prod domain)
```

**Domains:** `stackedpokerai.com` must be the Production domain in Vercel →
Project → Settings → Domains, with `www.stackedpokerai.com` redirecting to it.
The project's default `*.vercel.app` URL cannot be unassigned, but the app's
own `next.config.ts` redirects it (and `www`) to the apex domain — see
`frontend/next.config.ts`.

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
ALLOWED_ORIGINS=https://stackedpokerai.com
FRONTEND_URL=https://stackedpokerai.com   ← used for Stripe checkout/portal
                                             redirect URLs. If this is stale
                                             (e.g. still an old *.vercel.app
                                             value) users get sent back there
                                             after checkout/billing-portal.
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
