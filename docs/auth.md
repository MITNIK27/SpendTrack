# Authentication & Authorization

Google Sign-In via Firebase Authentication, restricted to `@infobeans.com`, plus role-based
authorization (Member / Approver / Admin) enforced entirely server-side.

## Architecture

```
Browser                    React Portal                    FastAPI Backend
  │                              │                                │
  ├─ Sign in with Google ──────► Firebase Auth SDK                 │
  │                              │ (Google popup; 'hd' domain       │
  │                              │  hint is UX only, not security)   │
  │                              ▼                                │
  │                        Firebase ID token ────────────────────►│ POST /api/auth/google
  │                              │                        { id_token }
  │                              │                                ▼
  │                              │                     firebase-admin verifies:
  │                              │                     signature, issuer, audience,
  │                              │                     expiry, email_verified,
  │                              │                     domain == infobeans.com
  │                              │                                │
  │                              │                     find/create User by firebase_uid
  │                              │                     (new → role="member", never
  │                              │                      client-influenced; name synced
  │                              │                      from Google's `name` claim)
  │                              │                     reject if is_active == False
  │                              │                                ▼
  │                              │◄──── { access_token (app JWT), user }
  │                        held in memory only
  │                        (never localStorage)
  │                              │                                │
  ├─ every API call ─────────────┼── Authorization: Bearer <jwt> ►│ decode → load User by id
  │                              │                                │ 401 if invalid/expired
  │                              │                                │ 403 if is_active == False
  │                              │                                ▼
  │                              │                     require_role("approver","admin")
  │                              │                     on sensitive routes → 403
  │                              │                                │
  │                              │                     object-level check (own resource) → 404
```

Google answers "who is this person"; the backend independently decides "what can they do" from
the DB-loaded `User.role`/`is_active` — never from anything the client sends.

## Session model

- The backend mints its **own** short-lived JWT (`JWT_EXPIRES_MINUTES`, default 60) after
  verifying the Firebase ID token — it is not the Firebase token itself.
- The JWT carries **only** `sub` (user id) and `exp` — deliberately no `role`. `get_current_user`
  re-reads `role`/`is_active` from the `users` table on **every** request, so a role change or
  deactivation takes effect on the user's very next API call, not whenever their token happens to
  expire.
- The frontend keeps the token **in memory only** (a module-scope variable in
  `frontend/src/auth/tokenStore.ts`) — never `localStorage`/`sessionStorage`. A page refresh
  doesn't lose the session because Firebase persists its *own* session securely; on load,
  `AuthContext` gets a fresh Firebase ID token and re-exchanges it for a new app JWT.
- Logout is stateless: the frontend calls Firebase's sign-out and discards its in-memory token.
  There's no server-side token revocation list — tokens are short-lived enough that this is an
  accepted tradeoff.

## RBAC model

Three roles on `users.role`: `member`, `approver`, `admin`. Extensible later (e.g. `finance`)
without any architecture change.

- **Member** — the default for every new Google sign-in. Creates initiatives/spend requests, sees
  only their own drafts.
- **Approver** — everything a Member's read access covers, plus deciding on spend requests
  (`POST /api/spend-requests/{id}/decisions`, `approve-batch`) and the leadership reports.
- **Admin** — everything an Approver can do, plus the Admin Console and User & Role Management.

Enforcement is centralized via `app/api/deps.py::require_role(*roles)`, used as a FastAPI
dependency on every sensitive route — never an inline `if` scattered per-handler.

## How do I make someone an Approver?

**No code change, no database access.** Sign in to the portal as an Admin → **Admin Console** →
**User & Role Management** → change their role in the dropdown. Every change is logged
(`activity_logs`, `action="role_changed"`).

The *very first* Admin/Approver is the one exception — see below.

## Bootstrapping the first Admin

There is intentionally no in-app way to create the first Admin (any such path would itself be a
privilege-escalation hole). One-time only, direct SQL, after the intended admin has signed in via
Google at least once (so their row exists):

```sql
UPDATE users SET role = 'admin' WHERE email = 'paarthp.sahni@infobeans.com';
UPDATE users SET role = 'approver' WHERE email = 'siddharth.sethi@infobeans.com';
```

From then on, every further role change goes through the Admin > Users screen.

## Security model

- **No client-supplied identity ever trusted.** Every route derives "who is this" from the
  verified JWT and "what are they" from the DB row it loads — never a request body's `user_id` or
  `role`. The only endpoint that ever accepts a `role` field is the Admin PATCH endpoint, itself
  gated by `require_role("admin")`.
- **Object-level authorization**, not just role checks: `spend_request_visibility.py` /
  `initiative_visibility.py` scope every query/read to what the caller is actually allowed to see
  — a Member can't fetch another Member's draft by guessing its id (404, not 403, so existence
  isn't leaked either).
- **Self-protection guards**: an Admin can't change their own role or deactivate their own account
  (409) — prevents an org being locked out of Admin access by a single misclick.
- **Every auth-relevant event is audited** in `activity_logs`: `login`, `user_created`,
  `role_changed`, `user_activated`/`user_deactivated`. Never logs the raw ID token, app JWT, or
  any secret.
- **CORS** is an explicit origin allowlist (never `*`). Bearer-token auth means no ambient cookie
  is auto-attached by the browser, so CSRF is out of scope by construction.
- **Security headers**: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin` on every response.

## Environment variables

**Backend** (`backend/.env`):
```
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json   # never commit this file
GOOGLE_ALLOWED_DOMAIN=infobeans.com
JWT_SECRET=          # random, generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_EXPIRES_MINUTES=60
```

**Frontend** (`frontend/.env`) — all public by design, safe to expose:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

## Local dev setup

1. Firebase Console: create a project, enable the Google sign-in provider, register a Web app for
   the public config, generate an Admin SDK service account key. Full click-by-click steps were
   walked through during setup — the short version above covers what each value is for.
2. Drop the service account JSON at `backend/firebase-service-account.json` (gitignored).
3. Fill in both `.env` files per above.
4. `alembic upgrade head` (includes the `member` role rename and the `name`/`last_login_at`
   columns), then `python -m scripts.seed_users` for the 3 known dev accounts.
5. Run the backend/frontend as usual — `/login` now shows a real "Sign in with Google" button.

## Testing

`backend/tests/integration/test_google_auth.py` and `test_admin_users.py` cover: valid/invalid
Firebase tokens (mocked — no real Google token needed), wrong domain, unverified email, inactive
user, new-user auto-provisioning, the existing dev-seeded accounts being matched by email and
backfilled, an Admin managing roles, self-change/self-deactivation guards, and a deactivated
user's live session losing access immediately. `backend/tests/conftest.py::headers()` builds a
real app JWT for a seeded user directly (bypassing Firebase) so tests exercise the exact same
token-verification path production traffic goes through.
