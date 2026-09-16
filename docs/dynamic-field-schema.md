# Dynamic category-specific justification questions — canonical source

When a requester picks a Category (and, implicitly, any Subcategory under it), the
Add-Spend form's Business Justification step should surface a handful of extra
questions specific to that kind of spend — e.g. a conference asks about
attendees/leads/sponsorship level, an ad campaign asks about objective/geography/CPL.
This is `Subcategory.dynamic_field_schema` (JSONB): an ordered list of
`{key, label, type, required}` objects. Answers are collected into
`SpendRequest.dynamic_answers`, a JSONB object keyed the same way.

This file is the source of truth for the seed migration
(`ef8f1c8a91a2_seed_dynamic_field_schema.py` at the time of writing — check
`backend/alembic/versions/` for the actual seeding migration if this note goes
stale) — if the question set changes, edit it here first, then add a new
migration. Applied per-category in this first pass (every subcategory under a
category gets the same question set) rather than per-subcategory — a finer,
per-subcategory breakdown (e.g. "Conference → Booth" vs. "Conference →
Speaking slot" asking different things) is a reasonable future refinement, not
built here.

`type` is one of `text`, `number`, `boolean`.

## A. Conferences & Events

| key | label | type | required |
|---|---|---|---|
| number_of_attendees | Number of attendees | number | false |
| expected_customer_meetings | Expected customer meetings | number | false |
| target_accounts | Target accounts | text | false |
| expected_leads | Expected leads | number | false |
| speaking_opportunity | Speaking opportunity? | boolean | false |
| has_booth | Booth? | boolean | false |
| sponsorship_level | Sponsorship level | text | false |

## B. Advertising & Paid Promotion

| key | label | type | required |
|---|---|---|---|
| campaign_objective | Campaign objective | text | false |
| target_geography | Target geography | text | false |
| target_audience | Target audience | text | false |
| campaign_duration | Campaign duration | text | false |
| expected_impressions_leads | Expected impressions/leads | text | false |
| landing_page | Landing page | text | false |
| expected_cpl_conversion | Expected CPL / conversion | text | false |

## F. Customer / Prospect Engagement

| key | label | type | required |
|---|---|---|---|
| customer_prospect_name | Customer/prospect name | text | false |
| purpose | Purpose | text | false |
| number_of_attendees | Number of attendees | number | false |
| expected_business_outcome | Expected business outcome | text | false |
| account_opportunity | Account opportunity | text | false |

All other categories (C, D, E, G–Q) have no dynamic questions in this pass —
just the generic Business Justification fields (`justification_why`,
`expected_outcome_type`, `expected_outcome_details`).
