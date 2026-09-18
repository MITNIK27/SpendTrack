# Architecture

## Stack

- **Frontend:** Vite + React + TypeScript, `react-router-dom`, TanStack Query. UI built on
  **shadcn/ui + Tailwind v4**, themed per `design-kit/02-THEME.md` — see `design-kit/README.md`
  for the full InfoBeans brand/component kit, which is mandatory for every screen.
- **Backend:** Python + FastAPI, SQLAlchemy 2.x + Alembic, PostgreSQL 16. All money columns are
  `Numeric(14,2)`.
- **Database hosting:** primarily a **Supabase** Postgres project (Session pooler connection —
  see `backend/.env.example`), with local Docker Postgres (`docker-compose.yml`, host port `5434`,
  **Adminer** at `localhost:8080`) kept as a fully-offline alternative for local dev.

## Authentication — Google Sign-In via Firebase (done)

Production auth is **Firebase Authentication**, Google Sign-In restricted to `@infobeans.com`.
See `docs/auth.md` for the full flow, RBAC model, and how to make someone an Approver. In short:
the frontend gets a Firebase ID token via the Google sign-in popup, exchanges it for the app's own
short-lived JWT at `POST /api/auth/google`, and every subsequent request carries that JWT as
`Authorization: Bearer`. `app/api/deps.py::get_current_user` / `app/core/security.py` are what
changed from the earlier dev-auth stub — no other route code needed to change.

## Deferred integrations (explicit, temporary — see Phase 12 of the plan)

One piece of "real" infra is still intentionally stubbed for V1:

- **File storage:** production storage will be Firebase Storage, uploaded via a backend-mediated
  multipart endpoint. Until then, `app/storage/local_disk.py` implements the same
  `StorageBackend` interface (`app/storage/base.py`) by writing to `backend/uploads/`. Swapping in
  `FirebaseStorage` later means adding one more implementation of that interface — no API or DB
  changes.
- **Email:** notifications are always recorded in the `notifications` table; actual sending goes
  through a swappable `EmailSender` interface. V1 ships a no-op sender; real SMTP is a later V1
  sub-phase.

## Authorization model

Every route enforces authorization **server-side**, reading role and ownership from the
DB-loaded `User`/`SpendRequest`/`Initiative` row — never from a client-supplied header, claim, or
body field beyond the identity lookup itself. See `docs/data-model.md` for the full schema and
`docs/workflow.md`-equivalent status lifecycle.

A draft `SpendRequest` is a private scratchpad: it's invisible to everyone but its own creator,
regardless of role (an approver/admin gets a 404, not just a member). This one rule is
centralized in `app/services/spend_request_visibility.py` (`visible_spend_requests_clause` for
queries, `is_spend_request_visible` for an already-loaded instance) and reused by the single-read,
list, initiative-detail, search, and reporting code paths — it must never be reimplemented
ad hoc at a new call site.

## Approval workflow

`POST /api/spend-requests/{id}/decisions` (`app/services/approval_service.py`) is the only way a
`SpendRequest`'s `status`/`approved_amount` change after submission — approve / approve a
different amount / reject / request changes, each writing an immutable `approval_actions` row
(see `docs/data-model.md`) plus an `activity_logs` entry. Only `approver`/`admin` may call it, and
only while the request is in `submitted`/`under_review`/`resubmitted`
(`approval_service.PENDING_DECISION_STATUSES`). A comment is mandatory for every decision except
plain `approve`.

## Reporting, search & alerts

- **Leadership report** (`GET /api/reports/spend-summary`, plus `/spend-summary/export` and
  `/spend-requests/export` for CSV) — approver/admin only, FY-scoped (see below), drafts always
  excluded. Filters are a single `ReportFilters` dataclass (`app/services/report_service.py`)
  shared by the JSON endpoint and both exports so they can never disagree on what "matches".
- **Fiscal year**: `app/core/fiscal.py` assumes an April–March year (the common Indian FY
  convention), labeled by the calendar year it ends in. This is an **unconfirmed assumption** —
  change `FISCAL_YEAR_START_MONTH` if stakeholders say otherwise; everything else derives from it.
- **Global search** (`GET /api/search?q=`) — `app/services/search_service.py`, ignores queries
  under 2 characters, matches initiative name or spend-request id/description/vendor/
  category/requester name, respecting the same draft-visibility rule.
- **Decision drill-down** (`GET /api/reports/spend-requests`, JSON) — the same matched set
  behind `/spend-summary`'s KPIs/category rollup, one row per spend request, enriched with its
  most recent `ApprovalAction` (`decided_by`, `decision_comment`). Backs the Leadership
  Dashboard's click-a-KPI-tile-or-category-row drill-down and is also what the CSV export now
  reuses (`report_service.spend_request_rows`), so the two can never disagree.
- **Cascading Initiative filter**: `GET /api/initiatives` takes optional `name` (`ilike`) and
  `category_id` (only initiatives with a matching, visible spend request, via `EXISTS`) query
  params — the Leadership Dashboard's Initiative picker is a server-searched combobox scoped by
  whatever Category is selected, not a plain "list every initiative" dropdown.
- **Spend control alerts** (`GET /api/reports/alerts`, approver/admin only) —
  `app/services/alert_service.py` computes four conditions on every request rather than running a
  background job: a request pending too long (`PENDING_TOO_LONG_DAYS`), actual spend exceeding
  approved, an active initiative whose event is coming up soon (`INITIATIVE_ENDING_SOON_DAYS`), and a
  past-event initiative with significant unspent approved budget (`SIGNIFICANT_UNUTILIZED_RATIO`). All three
  thresholds are plain module constants in that file.

## Why Initiative + SpendRequest, not one flat "expense" table

The product's core rule: **the Initiative provides context, the SpendRequest provides financial
control.** An initiative (e.g. "Gartner Conference 2026") never itself holds an amount or a
status derived from approval — it groups one or more independently-approvable SpendRequests
(Registration, Sponsorship, Flights, ...), each with its own requested/approved/actual amounts
and its own approval cycle. Adding money to an existing initiative always means creating a new
SpendRequest, never editing an approved one.
