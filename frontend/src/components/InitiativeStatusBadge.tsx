import { cn } from "@/lib/utils"
import type { Initiative } from "@/types/domain"

export type InitiativeOutcome = "draft" | "archived" | "active" | "approved" | "rejected" | "partial"

export const OUTCOME_LABELS: Record<InitiativeOutcome, string> = {
  draft: "Saved",
  archived: "Archived",
  active: "Approval Pending",
  approved: "Approved",
  rejected: "Rejected",
  partial: "Partially Approved",
}

const clsMap: Record<InitiativeOutcome, string> = {
  draft: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
  active: "bg-chip-active-bg text-chip-active-fg",
  approved: "bg-chip-success-bg text-chip-success-fg",
  rejected: "bg-chip-rejected-bg text-chip-rejected-fg",
  partial: "bg-chip-warning-bg text-chip-warning-fg",
}

/** Just the dot color per outcome (the `text-*-fg` half of `clsMap`, as a
 * solid background) — for anywhere that wants the same color language as
 * the badge without the full pill (e.g. a filter dropdown's option list). */
export const OUTCOME_DOT_CLASS: Record<InitiativeOutcome, string> = {
  draft: "bg-muted-foreground",
  archived: "bg-muted-foreground",
  active: "bg-chip-active-fg",
  approved: "bg-chip-success-fg",
  rejected: "bg-chip-rejected-fg",
  partial: "bg-chip-warning-fg",
}

/** One badge, one outcome — never two stacked. "Active" only ever means
 * "still open, nothing decided yet"; once anything's been decided, the
 * badge reflects that outcome (Approved/Rejected/Partially Approved)
 * instead of the raw draft/active/closed/archived lifecycle status, which
 * conflates "closed because approved" with "closed because rejected". */
export function InitiativeStatusBadge({
  initiative,
}: {
  initiative: Pick<Initiative, "status" | "budget_decision" | "approval_progress" | "spend_request_count">
}) {
  const outcome = deriveOutcome(initiative)
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide", clsMap[outcome])}>
      <span className="size-1.5 rounded-full bg-current" />
      {OUTCOME_LABELS[outcome]}
    </span>
  )
}

/** Exported so filter UI (e.g. the Initiatives list's status filter) can
 * offer/match exactly the categories this badge actually renders, instead
 * of the raw draft/active/closed/archived lifecycle status. Takes just the
 * four fields it actually needs (not the full Initiative) so a lighter
 * shape — e.g. a global search result row — can reuse it too. */
export function deriveOutcome(
  initiative: Pick<Initiative, "status" | "budget_decision" | "approval_progress" | "spend_request_count">,
): InitiativeOutcome {
  if (initiative.status === "draft") return "draft"
  if (initiative.status === "archived") return "archived"

  if (initiative.spend_request_count === 0) {
    if (initiative.budget_decision === "approved") return "approved"
    if (initiative.budget_decision === "rejected") return "rejected"
    return "active"
  }

  switch (initiative.approval_progress) {
    case "approved":
      return "approved"
    case "rejected":
      return "rejected"
    case "partial":
      return "partial"
    default:
      return "active"
  }
}
