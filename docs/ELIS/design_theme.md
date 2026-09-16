# Ellis — Design Theme

## Color palette

| Token | Hex | Used for |
|---|---|---|
| `--charcoal` | `#373742` | Header bar, primary text, dark surfaces, wordmark background |
| `--ivory` | `#FFF9ED` | Page background, text on dark surfaces |
| `--ivory-2` | `#F1ECE2` | Secondary/neutral surfaces — muted status badges, quiet cards |
| `--red` | `#EA1B3D` | Primary accent — CTAs, the "Ellis." full stop, urgent counts (Profiles for Review) |
| `--maroon` | `#AA142D` | Pressed/active state of red; app-owned column headers in the Sheet |
| `--green` | `#2F8F5B` | Positive state — Screen Select, resolved/success confirmations |
| `--amber` | `#C98A16` | Pending/in-between state — Review Pending, On Hold |
| `--muted` / `--slate` | `#85858f` / `#6B7280` | Secondary text, labels, timestamps |
| `--line` | `#e5dfd2` | Borders, dividers |

**Logic behind the palette:** charcoal and ivory form the brand's neutral
base — one dark, one light, both used for surfaces depending on context. Red
is the *only* accent color; it never competes with a second bright color, so
when something is red (a count, a button, the full stop in "Ellis."), it
reads as deliberate. Green and amber are functional, not decorative — they
only ever mean "resolved" and "pending," never used as arbitrary highlight
colors.

## Typography

**Lexend** — the entire app runs on one typeface, weights 300–700, loaded
from Google Fonts. Chosen for its clarity at small sizes on mobile screens
(it's designed with reading proficiency in mind) and because a single
typeface family keeps the app feeling calm rather than busy.

- **300 (Light)** — body copy, descriptions, secondary text
- **400–500** — labels, field values
- **600 (Semibold)** — headings, button text, emphasis
- **700 (Bold)** — the wordmark, large stat numbers

System font fallback: `-apple-system, system-ui, sans-serif`.

## Voice and tone

- **Direct, not corporate.** "Every US profile waiting on you, in one
  queue. Read, decide, done — from your phone." No filler, no buzzwords.
- **Explains the *why*, briefly.** The "Why Ellis" line in the guide is the
  only place the app indulges in a little narrative — everywhere else, copy
  is purely functional.
- **Never guesses at what the user wants.** Buttons say exactly what they
  do: "Send back to reviewer," not "Submit."

## Recurring UI patterns

- **Stat box** — big number, small label underneath. Red fill = needs
  attention now; white = informational; charcoal = structural/navigational
  (Active Requirements).
- **Pill** — small rounded status badge. Color maps to meaning: green
  (Select), maroon (Reject), amber (Pending/Hold) — never arbitrary.
- **Done-note** — a soft ivory-2 card used for anything already-recorded:
  a past decision, resolved Q&A, logged feedback. Signals "this happened,"
  as distinct from the sharper white decision-box card, which signals
  "action needed."
- **Decision-box** — white card, sharper border, used only when the app is
  actively asking the person to do something (make a call, answer a
  question, leave feedback).

---

## "What is Ellis" — section content

Use this wherever the app needs to introduce itself — a guide screen, a
stakeholder email, a landing page, or a slide.

### Short (one line)
> Ellis is a lightweight, mobile-first candidate review and decisioning web
> app that lets hiring stakeholders review and decide on US candidate
> profiles from their phone — synced live with our recruiting spreadsheet.

### Medium (elevator pitch)
> Ellis turns candidate review into something you can actually do from your
> phone. It syncs directly with our Google Spreadsheet, pulling candidate
> data straight from there — resume, experience, salary expectations,
> recruiter notes, all on one screen. Make the call — Screen Select, Screen
> Reject, or On Hold if you need something clarified first — and it's
> reflected back in the spreadsheet instantly. No new system to learn, no
> copy-pasting, nothing to install beyond adding a home-screen icon.

### Long (guide / about page)

**Ellis.**
*Every US profile waiting on you, in one queue. Read, decide, done — from
your phone.*

Reviewing candidates used to mean scrolling a wide spreadsheet on a small
screen — slow, and easy to miss things. Ellis fixes that by giving
stakeholders one focused screen per candidate, and turning a decision that
used to take a laptop and a follow-up email into something that takes under
a minute, from anywhere.

**Why the name:** Ellis Island was the gateway every arrival passed through
before entering the country. This is that gateway for our US hiring —
nothing moves forward until it's cleared here.

**What it does:**
- Shows every candidate waiting on a decision, organized by requirement
- Full candidate detail on one screen — resume, LinkedIn, experience,
  expected salary, location, visa status, recruiter's notes
- Three decision options — Screen Select, Screen Reject, or On Hold when
  something needs clarifying first
- Interview slots can be proposed the moment a candidate is selected — no
  separate scheduling thread
- On Hold questions go straight to the recruiting team by email, and the
  candidate returns to the queue automatically once answered
- Interview feedback logged separately for each round — L1, L2, HR — so
  nothing gets overwritten
- The full pipeline for any role is visible with a tap, stage by stage

**What stays the same:** the recruiting team keeps maintaining the tracker
exactly as before. Ellis reads live from it and writes only the columns it
owns — nothing about the underlying workflow changes.

---

*Built by Manav Agrawal & Suraj Chouhan — InfoBeans Technologies, Talent
Acquisition.*
