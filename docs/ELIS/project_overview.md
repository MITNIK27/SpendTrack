# Ellis — Project Overview

## What it is

Ellis is a mobile-first web app that lets hiring stakeholders review and decide
on US candidate profiles from their phone, without ever opening a spreadsheet.
It sits on top of the recruiting team's existing Google Sheet tracker — reading
live data from it, and writing decisions straight back — so nothing about how
the recruiting team works day to day has to change.

**One-line description:** Ellis is a lightweight, mobile-first candidate
review and decisioning web app that syncs directly with our Google
Spreadsheet — pulling candidate data, and reflecting every reviewer's
decision back into the sheet in real time.

## The problem it solves

Reviewing US hiring candidates meant scrolling a wide spreadsheet on a small
screen — slow, easy to miss details, and not something a stakeholder wants to
do between meetings. There was also no structured way to ask a recruiter a
clarifying question before deciding, propose interview times, or log
interview feedback without it getting buried in a free-text cell.

## Who uses it

- **Reviewers** (Siddharth Sethi, Mitesh Bohra, Avinash Sethi, Denise Cheung,
  Kanupriya Manchanda, Ram Lakshmi, Suraj Chouhan) — open the app, review
  candidates, and record Screen Select / Screen Reject / On Hold decisions,
  propose interview slots, and log interview feedback.
- **Viewers** (Manav Agrawal, Virendra Kumar) — see everything reviewers see,
  but can't record a decision. Full visibility for the TA team without
  decision-making risk.
- **Recruiters** (Suraj Chouhan, notified via email) — maintain the
  underlying tracker sheet as before, and additionally answer On Hold
  questions raised by reviewers, right inside Ellis.

Access is enforced server-side against named email lists — not just hidden
buttons — so anyone outside these lists sees a clear "no access" screen
showing which account they're signed in as, with no candidate data ever sent
to their browser.

## What Ellis actually does

**Home dashboard** — one glance tells a reviewer everything waiting on them:
- Active Requirements (how many roles are open)
- Profiles for Review (candidates needing a decision)
- On Hold — Needs Response (candidates with an open question)
- Interviews to be Scheduled (cleared, not yet booked)
- Interviews Planned (L1/L2/HR already on the calendar)

**Reviewing a candidate** — one screen shows resume, LinkedIn, experience,
expected salary, location, visa status, and the recruiter's notes. Three
decision options:
- **Screen Select** — also lets the reviewer propose up to 3 interview time
  slots (date, 15-minute time increments, IST/EST timezone), so scheduling
  doesn't need a separate email thread.
- **Screen Reject** — screens the candidate out.
- **On Hold** — for anything in between. Requires a note on what's unclear.
  The recruiter is emailed immediately, and the candidate reappears in the
  reviewer's queue automatically the moment it's answered — with the full
  question-and-answer history intact, even across multiple back-and-forth
  rounds.

**Interview feedback** — after an L1, L2, or HR round, the reviewer opens the
candidate from "Interviews Planned" and gets a focused screen (just resume,
LinkedIn, and a feedback box) instead of the full record. Each stage keeps
its own separate feedback, so a later round never overwrites an earlier one.

**Pipeline visibility** — tapping into any requirement shows its full
pipeline, broken down by stage, and any stage can be tapped to see exactly
who's there — useful before a review call when the whole picture matters
more than just the queue.

## What doesn't change

Suraj continues maintaining `Current Status`, requirement data, and candidate
details directly in the sheet exactly as before. Ellis never touches
`Current Status` — it only writes to columns it owns (clearly marked maroon
in the sheet), so the recruiter's ownership of the source data is untouched.

## Platform

A Google Apps Script web app — runs in any mobile or desktop browser, no app
store, no install. Add-to-home-screen makes it behave like a native app. No
external services, no API costs — built entirely on tools InfoBeans already
has (Apps Script + Sheets), the same stack as JD Formatter and TA Org Tree.

## Credits

Built by Manav Agrawal & Suraj Chouhan, InfoBeans Technologies — Talent
Acquisition.
