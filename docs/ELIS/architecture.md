# Ellis — Architecture

## Stack

- **Backend:** Google Apps Script (`Code.gs`) — server-side JavaScript running
  on Google's infrastructure, no separate hosting.
- **Frontend:** Single `Index.html` file — vanilla JS, no framework, no build
  step. Served by Apps Script's `HtmlService` as a web app.
- **Data store:** Google Sheets — one spreadsheet, two tabs (`Open
  Requirements`, `Profile Details`).
- **Comms:** `MailApp` for email notifications — no external email service.
- **Deployment:** Apps Script Web App (`Execute as: Me`, `Who has access:
  Anyone within InfoBeans`).

No external APIs, no npm dependencies, no database beyond the Sheet itself.

## Client/server boundary

The frontend calls the backend exclusively through `google.script.run`,
Apps Script's built-in RPC bridge. Two entry points carry almost all traffic:

- `getDashboardData()` — read-only, returns everything the dashboard needs in
  one call: all requirements, all profiles (with computed fields), the
  signed-in user's access level.
- `submitReview(profileId, decision, remarks, slots)` — the main write path
  for Screen Select / Screen Reject / On Hold.
- `submitInterviewFeedback(profileId, stage, feedback)` — writes L1/L2/HR
  feedback independently per stage.
- `submitRecruiterResponse(profileId, response)` — answers an On Hold
  question and clears the decision so the candidate requeues.

Every write function re-checks the signed-in user's permission level
server-side (`accessFor_(email)`), independent of what the browser sent —
hiding a button client-side is never treated as access control.

## Access control

Two hardcoded email lists in `Code.gs`:

- `REVIEWERS` — can view everything and record decisions (Screen
  Select/Reject/On Hold, interview feedback, On Hold responses).
- `VIEWERS` — can view everything, cannot record decisions.
- `ALLOW_ANY_INFOBEANS_VIEWER` (default `false`) — optional escape hatch to
  let any `@infobeans.com` account view (never decide), if the list-based
  approach becomes too restrictive.

`accessFor_(email)` resolves both into `{ canReview, canView }`, computed
fresh on every `getDashboardData()` call — nothing is cached client-side
across sessions.

`SHEET_EDITORS` is separate — controls who can edit the underlying Sheet
directly (bypassing the app entirely), independent of app-level access.

`RECRUITER_NOTIFY_EMAILS` controls who gets emailed when a candidate goes On
Hold.

## Data model — Profile Details tab

The app reads/writes by fixed column **position**, not by header name — so
column order must never change once live; new fields are always appended at
the end.

| Col | Field | Written by |
|---|---|---|
| 1 | Profile ID | Recruiter |
| 2 | Requirement ID | Recruiter (dropdown, sourced from Tab 1) |
| 3 | Requirement Name | Formula (auto-fill from Requirement ID) |
| 4 | Candidate Name | Recruiter |
| 5 | Current Status | Recruiter (dropdown — never written by the app) |
| 6–10 | Resume / LinkedIn / L1 / L2 / HR links | Recruiter |
| 11–16 | Experience, location, visa, salary, recruiter remarks | Recruiter |
| 17 | Reviewer Decision | App — `Screen Select` / `Screen Reject` / `On Hold` |
| 18 | Reviewer Remarks | App — **append-only log**, see below |
| 19–20 | Reviewed On / By | App |
| 21–23 | Proposed Slot 1/2/3 | App — only written on Screen Select |
| 24–26 | L1 Interview Feedback / By / On | App |
| 27–29 | L2 Interview Feedback / By / On | App |
| 30–32 | HR Interview Feedback / By / On | App |
| 33 | Recruiter Response | App — **append-only log**, see below |
| 34–35 | Response By / On | App |

Columns the app owns are flagged maroon in the sheet header, so it's visually
obvious which cells a recruiter shouldn't hand-edit.

### Append-only Q&A logging

Reviewer Remarks (col 18) and Recruiter Response (col 33) are the two
exceptions to "overwrite on every write" — they're **append logs**, because
On Hold can go through multiple rounds (ask → answer → ask again) and no
round should erase the previous one.

`appendLogEntry_(existingValue, label, newText)` in `Code.gs` handles this:
each call appends a new `[timestamp] Label: text` entry, separated by a blank
line, onto whatever was already in the cell.

**Display ordering — structural, not timestamp-based.** The frontend's
`buildQAThread()` interleaves questions and answers by **array position**
(the 1st question pairs with the 1st answer, the 2nd with the 2nd, etc.),
not by parsing and sorting timestamps. This was a deliberate correction —
timestamp sort broke whenever two entries landed in the same minute (or even
the same second, for fast-typed test data). Position-pairing is exact by
construction: one On Hold submission always produces exactly one new
question; one response submission always produces exactly one new answer.

### `needsResponse` — the multi-round-aware flag

A candidate needs a recruiter response when:
```
decision === 'On Hold' AND (
  no response has ever been recorded
  OR the most recent question is newer than the most recent response
)
```
This is a **timestamp comparison** (not "is the response cell empty"),
because the response cell is never empty again after round 1 — it keeps
accumulating history. Comparing `Reviewed On` vs `Response On` is what
correctly detects "there's a new unanswered round" even after several cycles.

## Application flow (frontend)

Single-page app, no routing library — a `nav` stack of plain objects drives
everything:
```
{ v: 'home' }
{ v: 'req', reqId }
{ v: 'stage', reqId, status }
{ v: 'group', gkey }        // one of the 4 dashboard widgets
{ v: 'profile', pid, mode } // mode is optional context
{ v: 'guide' }
```
`render()` switches on `nav[nav.length-1].v` and calls the matching
`renderX()` function. `push()` / `goBack()` / `goHome()` manipulate the stack;
the header's back arrow just pops it.

### `mode` — why the same candidate can show two different screens

`renderProfile(pid, mode)` branches on `mode` to decide which view to show:

- `mode === 'feedback'` (reached via the **Interviews Planned** widget) + the
  candidate is currently at an L1/L2/HR Scheduled status → simplified view:
  resume/LinkedIn + a feedback box for that specific stage. No facts card, no
  decision box.
- `mode === 'respond'` (reached via the **On Hold — Needs Response** widget)
  + `decision === 'On Hold'` → shows the full Q&A thread, and — if
  `needsResponse` — a response form.
- Anything else (reached via a requirement's pipeline, or a stage list) →
  the full record: facts, recruiter remarks, any interview feedback on
  record, any resolved On Hold history, and the decision box if pending.

This was a deliberate design choice after early iterations conflated
*candidate state* with *how you navigated there* — a candidate whose status
happens to be "L1 Scheduled" should still show their full record when opened
through the pipeline, and only show the stripped-down feedback view when
specifically opened through the Interviews Planned shortcut.

## Migrations

Schema changes to an **already-live** sheet never happen automatically —
`setup()` only runs once, on a brand-new tracker. Each schema addition has a
matching one-off migration function, run manually from the Apps Script
editor, that only adds what's missing without touching existing data:

| Function | Adds |
|---|---|
| `setup()` | The tracker itself, both tabs, from scratch |
| `upgradeSheet()` | `Reviewed By` column; locks sheet sharing |
| `addInterviewSlotColumns()` | Proposed Slot 1/2/3 |
| `addInterviewFeedbackColumns()` | L1/L2/HR feedback columns |
| `addRecruiterResponseColumns()` | Recruiter Response columns |
| `refreshStatusDropdown()` | New `Current Status` options (e.g. On Hold, Backout) |
| `refreshDecisionDropdown()` | New `Reviewer Decision` options |
| `resetTracker()` | Clears the `SHEET_ID` pointer, for a full fresh start |

`checkAccessLists()` is a standalone sanity check — flags malformed
addresses, duplicates, or non-InfoBeans domains in the access lists before
they're relied on.

## Deployment model

- **`/exec`** — the published, stable URL. Only updates on
  **Deploy → Manage deployments → New version → Deploy**. This is the only
  link ever shared with reviewers.
- **`/dev`** — always reflects whatever's currently saved in the editor, no
  deployment needed. Restricted to accounts with editor access. Used only
  for the developer's own quick testing — never shared.

A very common failure mode during this build was editing/saving code without
redeploying a new version — the live `/exec` link silently keeps serving
whatever was last deployed. Always verify **Manage deployments** shows a
recent version timestamp after a change.

## Notifications

`notifyRecruitersOnHold_()` fires from inside `submitReview()`, best-effort
(wrapped in try/catch — a failed email never blocks the decision from
saving). Sends to `RECRUITER_NOTIFY_EMAILS`, includes the candidate name,
requirement, the exact question text, and a direct link back into Ellis via
`ScriptApp.getService().getUrl()`.

## Known constraints / deliberate non-goals

- No push notifications beyond email — relies on the recipient checking mail
  or the app.
- `Current Status` is never written by the app, by design — keeps the
  recruiter as the single source of truth for pipeline stage.
- Column-position-based reads mean the header row can be relabeled freely,
  but columns can never be reordered or deleted without breaking the app.
- No offline support — every screen is a live round-trip to the Sheet.
