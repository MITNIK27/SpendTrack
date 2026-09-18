import type { ReactNode } from "react"
import {
  FolderKanban,
  Receipt,
  ClipboardCheck,
  ShieldCheck,
  LayoutDashboard,
  Search,
  BellRing,
  CheckCircle2,
  Users,
  Tags,
} from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { BrandLockup } from "@/components/BrandLockup"

const MEMBER_STEPS = [
  {
    icon: FolderKanban,
    title: "Start an Initiative",
    detail:
      "Give your event, campaign, or sponsorship a name and a purpose. This becomes the home for every request raised against it.",
  },
  {
    icon: Receipt,
    title: "Add Spend Requests",
    detail:
      "Break it down into requests — registration, flights, a booth, swag — each with its own category, amount, and a short justification.",
  },
  {
    icon: ClipboardCheck,
    title: "Submit for Review",
    detail:
      "One click sends it to your Approver, with everything they need to decide already attached — no separate email, no chasing.",
  },
  {
    icon: CheckCircle2,
    title: "Track Every Decision",
    detail:
      "Approved, sent back for changes, or rejected — you'll always know exactly where each request stands, and why.",
  },
]

const MEMBER_TIPS = [
  "Be specific in your justification — \"Booth at TechConf 2026, expected 400 leads\" clears review faster than \"marketing expense.\"",
  "Pick the closest category and subcategory — it's what feeds the leadership reports, and a mismatch is the most common reason for a request to bounce back.",
  "One initiative can hold many requests — add a new one any time instead of inflating an existing, already-approved request.",
]

const LEADERSHIP_RESPONSIBILITIES = [
  {
    icon: ClipboardCheck,
    title: "Review & decide",
    detail:
      "Approve, approve a different amount, reject, or send back for changes — each with a comment attached, forming an audit trail that never disappears.",
  },
  {
    icon: LayoutDashboard,
    title: "Leadership Dashboard",
    detail:
      "Fiscal-year spend, category rollups, and a drill-down from any KPI tile straight to the requests behind it.",
  },
  {
    icon: BellRing,
    title: "Spend control alerts",
    detail:
      "Requests pending too long, actual spend outpacing what was approved, budgets sitting unused — surfaced automatically, not discovered at quarter-end.",
  },
]

const ADMIN_RESPONSIBILITY = {
  icon: Users,
  title: "User & category management",
  detail:
    "Promote the next Approver, deactivate an account, or shape the spend category taxonomy — all without a code change or database access.",
}

const FEATURES = [
  {
    icon: FolderKanban,
    label: "Initiatives",
    detail:
      "A marketing initiative never carries its own amount or status — it groups one or more independently-approvable spend requests underneath it.",
  },
  {
    icon: Receipt,
    label: "Spend requests, tracked to a decision",
    detail: "An approved request is never quietly edited — adding more spend always means a new request.",
  },
  {
    icon: Search,
    label: "One search box, everything",
    detail: "Find an initiative or a spend request by id, description, vendor, category, or requester — instantly.",
  },
  {
    icon: Tags,
    label: "A real category taxonomy",
    detail: "Every request is classified the same way, every time — the same categories drive both requests and reports.",
  },
]

function Hero({ tagline }: { tagline: string }) {
  return (
    <div className="relative mb-10 overflow-hidden bg-sidebar px-8 py-14 text-sidebar-foreground shadow-lg">
      {/* Charcoal chrome base (the sidebar's own dark identity), deepening toward
          black in one corner with a low, smoldering crimson glow behind it —
          brand accent as an ember, not a wash. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-black" />
      <div className="pointer-events-none absolute -top-32 -right-20 size-96 rounded-full bg-primary/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-primary/10 blur-[90px]" />
      <div className="pointer-events-none absolute inset-0 border-b-2 border-primary" />
      <div className="relative max-w-2xl">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">About</div>
        <div className="mt-3">
          <BrandLockup on="dark" size="lg" />
        </div>
        <p className="mt-5 text-base font-light text-white/85">{tagline}</p>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <span className="h-4 w-1 bg-primary" />
      {children}
    </h2>
  )
}

function MemberAbout() {
  return (
    <>
      <Hero tagline="Raise it, request it, track it — complete visibility into your marketing spend, without the spreadsheet." />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeading>How it works for you</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {MEMBER_STEPS.map((s, i) => (
              <div key={s.title} className="flex items-start gap-4 border border-border bg-card p-5">
                <div className="grid size-9 shrink-0 place-items-center bg-primary/10 text-sm font-bold text-primary-text">
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <s.icon className="size-4 text-muted-foreground" /> {s.title}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading>Before you submit</SectionHeading>
          <ul className="flex flex-col gap-2">
            {MEMBER_TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-base text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-4 text-primary" />
            Every decision on your request is made by your Approver, recorded permanently, and
            visible to you the moment it happens.
          </p>
          <p className="text-xs text-muted-foreground/70">Built by Paarth Sahni — InfoBeans Technologies.</p>
        </section>
      </div>
    </>
  )
}

function LeadershipAbout({ isAdmin }: { isAdmin: boolean }) {
  const responsibilities = isAdmin ? [...LEADERSHIP_RESPONSIBILITIES, ADMIN_RESPONSIBILITY] : LEADERSHIP_RESPONSIBILITIES

  return (
    <>
      <Hero tagline="Every request, every decision, one system of record — nothing to reconstruct by hand before a review." />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeading>What's on your plate</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {responsibilities.map((r) => (
              <div key={r.title} className="flex items-start gap-4 border border-border bg-card p-5">
                <div className="grid size-10 shrink-0 place-items-center bg-primary/10">
                  <r.icon className="size-5 text-primary-text" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{r.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading>Why Initiative + Spend Request, not one flat "expense"</SectionHeading>
          <p className="max-w-3xl text-base text-muted-foreground">
            An initiative — a conference, a sponsorship, a campaign — provides context. It never
            holds an amount or a status of its own; it groups one or more independently
            approvable spend requests, each carrying its own requested, approved, and actual
            amount and its own approval cycle. That separation is what keeps financial control
            precise even as an initiative grows.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading>What it does</SectionHeading>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center bg-secondary">
                  <f.icon className="size-4 text-muted-foreground" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{f.label}</div>
                  <div className="text-sm text-muted-foreground">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-4 text-primary" />
            Every decision is enforced server-side by role and ownership — never by hiding a
            button on the screen.
          </p>
          <p className="text-xs text-muted-foreground/70">Built by Paarth Sahni — InfoBeans Technologies.</p>
        </section>
      </div>
    </>
  )
}

export default function About() {
  const { user } = useAuth()

  if (user?.role === "member") return <MemberAbout />
  return <LeadershipAbout isAdmin={user?.role === "admin"} />
}
