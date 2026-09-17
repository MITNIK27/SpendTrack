# InfoBeans Marketing Spend Portal

Internal portal for requesting and approving marketing expenditure. See `docs/architecture.md`,
`docs/data-model.md`, and `docs/category-taxonomy.md` for the full design.

## Local development

### 1. Database

The project's primary Postgres is hosted on **Supabase** (shared across whoever works on this,
easy to browse/monitor from the Supabase dashboard's Table Editor). Get the connection string
from the Supabase project's **Settings → Database → Connection string**, mode **Session
pooler** (port `5432`) — the plain "Direct connection" host only resolves over IPv6 unless
you've paid for Supabase's IPv4 add-on, which fails on most networks; the Session pooler is
IPv4-compatible and, unlike the Transaction pooler, works fine for Alembic's migrations too. Set
it as `DATABASE_URL` in `backend/.env` (see `backend/.env.example` for the exact format).

Prefer working fully offline, or want a disposable local sandbox instead? A local Postgres via
Docker still works as a drop-in alternative — point `DATABASE_URL` at it instead:

```bash
docker compose up -d      # Postgres on localhost:5434, Adminer on http://localhost:8080
```

Adminer login: server `postgres`, user `spend`, password `spend`, database `marketing_spend`.

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # .venv\Scripts\activate on native Windows shells
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8005
```

Port `8005`, not `8000` — `8000` is already used by another project on this machine.
Health check: `GET http://localhost:8005/api/health`.

### 3. Frontend (Vite + React + shadcn/ui)

```bash
cd frontend
npm install
npm run dev
```

No fixed port — Vite tries `5173` and falls through to the next free one (`5174`, `5175`, ...)
since other local projects also use `5173`/`9005`. **Check the terminal output for the actual
URL it lands on.** `backend/.env(.example)` lists `5173`–`5176` in `CORS_ALLOWED_ORIGINS` to cover
the likely range — if Vite picks something outside that, add it there too.

## Status

V1 auth and file storage are intentionally stubbed (dev-user header, local disk) until the domain
model and workflow are built and demoed — see `docs/architecture.md` § "Deferred integrations".
