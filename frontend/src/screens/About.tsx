import {
  ArrowLeft,
  FolderKanban,
  Receipt,
  ClipboardCheck,
  ShieldCheck,
  LayoutDashboard,
  Search,
  BellRing,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Logo } from "@/components/Logo"

const ROLES = [
  {
    label: "Team Member",
    detail:
      "Raises initiatives, adds spend requests against them, and tracks each one through review — the only role that can create or edit either.",
  },
  {
    label: "Approver",
    detail:
      "Sees every submitted, under-review, and resubmitted request across the company, and is the only role that can approve, reject, or send one back for changes.",
  },
  {
    label: "Admin",
    detail:
      "Everything an Approver can do, plus the Admin Console — managing categories and the underlying reference data the rest of the app runs on.",
  },
]

const FEATURES = [
  {
    icon: FolderKanban,
    label: "Initiatives",
    detail:
      "A marketing initiative — a conference, a sponsorship, a campaign — is the container for everything spent against it. It never carries its own amount or status; that discipline lives one level down.",
  },
  {
    icon: Receipt,
    label: "Spend requests, tracked to a decision",
    detail:
      "Every rupee is its own Spend Request with its own requested, approved, and actual amount. Adding more spend to a live initiative always means a new request — an approved one is never quietly edited.",
  },
  {
    icon: ClipboardCheck,
    label: "A real approval workflow",
    detail:
      "Submitted → Under Review → Approved / Rejected / Changes Requested → Resubmitted → Spent → Closed. Every decision is logged immutably, and a comment is required for anything other than a plain approve.",
  },
  {
    icon: LayoutDashboard,
    label: "Leadership Dashboard",
    detail:
      "Fiscal-year spend, category rollups, and a click-through drill-down from any KPI tile or category row straight to the underlying requests — for Approvers and Admins.",
  },
  {
    icon: BellRing,
    label: "Spend control alerts",
    detail:
      "Flags requests pending too long, actual spend exceeding what was approved, an initiative's event approaching with budget still unspent, and significant unspent budget after the fact.",
  },
  {
    icon: Search,
    label: "One search box, everything",
    detail:
      "Find an initiative or a spend request by id, description, vendor, category, or requester — without hunting through a spreadsheet or a filter panel first.",
  },
]

export default function About() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-primary/25 via-sidebar to-sidebar px-8 py-14">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-[880px] flex-col items-start gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <Logo on="dark" className="h-9" />
          <h1 className="text-3xl font-bold text-white">Marketing Spend Portal</h1>
          <p className="max-w-2xl text-base font-light text-white/70">
            Every marketing initiative and every rupee spent against it — requested, reviewed,
            and approved in one place, with a full record of who decided what, and when.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-8 py-12">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="h-4 w-1 bg-primary" />The problem it solves
          </h2>
          <p className="text-base font-light text-white/70">
            Marketing spend used to mean scattered trackers, approvals buried in email threads,
            and no single place to see what was requested, what was approved, and what was
            actually spent. Chasing that down before a leadership review meant reconstructing it
            by hand every time.
          </p>
          <p className="text-base font-light text-white/70">
            This portal replaces that with one system of record: raise an initiative, add spend
            requests against it as they come up, and route each one through approval — with the
            full history attached to the request itself, not a side conversation.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="h-4 w-1 bg-primary" />Why Initiative + Spend Request, not one flat
            "expense"
          </h2>
          <p className="text-base font-light text-white/70">
            An initiative — a conference, a sponsorship, a campaign — provides context. It never
            holds an amount or a status of its own; it groups one or more independently
            approvable spend requests (registration, flights, sponsorship, ...), each carrying
            its own requested, approved, and actual amount and its own approval cycle. That
            separation is what keeps financial control precise even as an initiative grows.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="h-4 w-1 bg-primary" />Who uses it
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r.label} className="border-t-2 border-primary bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">{r.label}</div>
                <div className="mt-2 text-sm font-light text-white/60">{r.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="h-4 w-1 bg-primary" />What it does
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center bg-primary/15">
                  <f.icon className="size-4 text-primary" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{f.label}</div>
                  <div className="text-sm font-light text-white/60">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-white/10 pt-6">
          <p className="text-sm font-light text-white/60">
            <ShieldCheck className="mr-1 inline size-4 text-primary" />
            Every decision is enforced server-side by role and ownership — never by hiding a
            button on the screen.
          </p>
          <p className="text-xs text-white/45">Built by Paarth Sahni — InfoBeans Technologies.</p>
        </section>
      </div>
    </div>
  )
}
