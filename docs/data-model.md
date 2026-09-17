# Data Model

All primary keys are UUIDs. All timestamps are `TIMESTAMPTZ`. All monetary columns are
`Numeric(14,2)` — never `float`.

## Entity relationship overview

```
User ──owns──▶ Initiative ──has many──▶ SpendRequest
  │                                         │
  │                                         ├──has many──▶ ApprovalAction (append-only)
  │                                         ├──has many──▶ Comment
  │                                         ├──has many──▶ Attachment
  │                                         └──has many──▶ ActivityLog (polymorphic)
  │
  ├──receives──▶ Notification
  └──approves──▶ ApprovalAction

Category ──has many──▶ Subcategory ──referenced by──▶ SpendRequest
```

`Initiative` is context; `SpendRequest` is financial control — every rupee is committed at the
`SpendRequest` level, never the `Initiative` level. See `docs/architecture.md`.

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| firebase_uid | VARCHAR, nullable, unique | Unused in V1 (dev-auth stub); populated once Firebase Auth is wired in (Phase 12) |
| email | VARCHAR, unique, not null | Dev-auth stub's lookup key (`X-Dev-User-Email` header) |
| display_name | VARCHAR | |
| role | ENUM(`member`,`approver`,`admin`) | Default `member`. **App-managed only** — never trusted from a client claim |
| is_active | BOOLEAN | Default true |
| created_at, updated_at | TIMESTAMPTZ | |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| code | CHAR(1), unique | `A`..`Q`, see `docs/category-taxonomy.md` |
| name | VARCHAR | |
| is_active | BOOLEAN | Soft-disable only — never hard-delete (spend requests hold FKs) |
| sort_order | INT | |
| requires_freetext_description | BOOLEAN | True only for `Q. Other` |

### `subcategories`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| category_id | UUID FK → categories | |
| name | VARCHAR | |
| is_active | BOOLEAN | |
| sort_order | INT | |
| dynamic_field_schema | JSONB, nullable | Ordered list of `{key, label, type, required}` — the category-specific justification questions the Add-Spend form asks when this subcategory is selected. See `docs/dynamic-field-schema.md` (canonical source) — seeded today for Conferences & Events (A), Advertising & Paid Promotion (B), and Customer/Prospect Engagement (F) only. |

### `initiatives`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| type | VARCHAR | Free text in V1 (e.g. "Conference / Event") |
| owner_id | UUID FK → users | |
| event_date | DATE | Single date of the event — no separate start/end |
| location | VARCHAR | Shown/collected only for location-relevant `type`s in the UI |
| status | ENUM(`draft`,`active`,`completed`,`archived`) | Independent of individual spend-request statuses — an initiative stays `active` even with some requests pending/rejected |
| target_audience | TEXT | |
| objective | TEXT | Doubles as the initiative's description |
| estimated_total_budget | NUMERIC(14,2), nullable | |
| expected_leads_meetings | TEXT | Free text in V1 (e.g. "20 meetings, 5 opportunities") |
| created_at, updated_at | TIMESTAMPTZ | |

### `initiative_team_members` / `spend_request_team_members` (M:N join tables)
`(initiative_id, user_id)` / `(spend_request_id, user_id)` composite PKs — colleagues
tagged as involved in an initiative or a specific spend request (e.g. who's
traveling to a conference). Read-only `/users` endpoint backs the picker.

### `spend_requests`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| initiative_id | UUID FK → initiatives, not null | |
| created_by_id | UUID FK → users, not null | |
| category_id | UUID FK → categories, not null | |
| subcategory_id | UUID FK → subcategories, nullable | |
| other_description | TEXT | Mandatory when category = Q (validated in service layer + DB CHECK) |
| description | TEXT, nullable | Auto-populated from category/subcategory name server-side when not supplied |
| vendor | VARCHAR | |
| requested_amount | NUMERIC(14,2), not null | **Immutable once submitted** |
| approved_amount | NUMERIC(14,2), nullable | Set only via an `approval_actions` row; mirrored here for querying |
| actual_amount | NUMERIC(14,2), nullable | Set later via mark-spent |
| currency | CHAR(3) | Default `INR` |
| status | ENUM(`draft`,`submitted`,`under_review`,`approved`,`rejected`,`changes_requested`,`resubmitted`,`spent`,`closed`) | See lifecycle below |
| current_cycle | INT, default 1 | Increments on every resubmission |
| submitted_at, decided_at, spent_at, closed_at | TIMESTAMPTZ, nullable | |
| vendor_quotation_amount | NUMERIC(14,2), nullable | |
| dynamic_answers | JSONB, nullable | Answers to the subcategory's `dynamic_field_schema` questions, keyed the same way |
| created_at, updated_at | TIMESTAMPTZ | |

`variance = approved_amount - requested_amount` is a **computed property, never a
stored column** — one source of truth, unit-tested directly. Fiscal-period
classification for reporting (`report_service.py`) is by `created_at` only.

### `spend_request_line_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| spend_request_id | UUID FK → spend_requests, `ON DELETE CASCADE` | |
| item | VARCHAR | |
| amount | NUMERIC(14,2) | |
| sort_order | INT | |

Optional cost breakdown (e.g. Registration ₹2,00,000 / Booth ₹5,00,000). When
present, the service layer requires the line items to sum to `requested_amount`
(400 if not) — the UI computes `requested_amount` from them automatically rather
than asking the requester to add it up by hand.

### `approval_actions` (append-only)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| spend_request_id | UUID FK, not null | |
| cycle | INT | Matches `spend_requests.current_cycle` at the time of the action |
| approver_id | UUID FK → users | |
| action | ENUM(`approve`,`approve_different_amount`,`reject`,`request_changes`) | |
| requested_amount_at_time | NUMERIC(14,2), not null | Snapshot — immune to later edits |
| approved_amount | NUMERIC(14,2), nullable | Required for `approve`/`approve_different_amount` |
| comment | TEXT | Mandatory for every action except plain `approve` |
| created_at | TIMESTAMPTZ | |

No PATCH/DELETE route is ever exposed on this table.

### `comments`
`spend_request_id` FK, `author_id` FK → users, `body` TEXT, `created_at`.

### `attachments`
`spend_request_id` FK, `uploaded_by_id` FK → users, `file_name`, `storage_path` (local disk in V1,
Firebase Storage path after Phase 12 — same column), `content_type`, `size_bytes`, `created_at`.

### `activity_logs` (append-only)
Polymorphic `(entity_type, entity_id)`, `actor_id` (nullable for system entries), `action`,
`metadata` JSONB, `created_at`. Indexed on `(entity_type, entity_id, created_at)`.

### `notifications`
`recipient_id` FK → users, `type`, `related_entity_type`/`related_entity_id`,
`channel` ENUM(`in_app`,`email`), `status` ENUM(`recorded`,`sent`,`failed`) — always `recorded` in
V1, `payload` JSONB (pre-computed subject/body context for the future SMTP sender).

## Status lifecycle (SpendRequest)

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | CHANGES_REQUESTED
                                        │
                         CHANGES_REQUESTED → (edit) → RESUBMITTED → UNDER_REVIEW  (loop)
                                        │
                                   APPROVED → SPENT → CLOSED
```

Editing rules: full edit in `DRAFT`/`CHANGES_REQUESTED`; financial fields locked once
`SUBMITTED`/`UNDER_REVIEW`/`APPROVED` (a `PATCH` on `requested_amount` at that point returns 409 —
additional money requires a **new** spend request); `REJECTED` stays visible in history forever,
never deleted.

## Future extension points (not built in V1, schema doesn't block them)

- A `budgets` table keyed on `(initiative_id, category_id)` for budget-vs-actual tracking.
- Real PO/invoice/reconciliation tracking is explicitly **out of scope** — routed to a
  procurement/Finance system instead. If a future integration needs to link back to that
  external system, prefer adding pass-through reference fields (e.g. `invoice_reference`) to
  `spend_requests` over building full ledger tables here — today's lightweight
  `actual_amount`/`spent_at`/`closed_at` fields are meant to stay that simple.
- Admin UI to manage `Subcategory.dynamic_field_schema` (currently seeded directly via an
  Alembic migration — see `docs/dynamic-field-schema.md`) — `AdminConsole.tsx`'s Category
  Management tile is still a "coming soon" stub.
