import { cn } from "@/lib/utils"

export type SpendRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "resubmitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "spent"
  | "closed"

const map: Record<SpendRequestStatus, { label: string; cls: string }> = {
  draft: { label: "Saved as Draft", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted for Approval", cls: "bg-chip-warning-bg text-chip-warning-fg" },
  under_review: { label: "Submitted for Approval", cls: "bg-chip-warning-bg text-chip-warning-fg" },
  resubmitted: { label: "Submitted for Approval", cls: "bg-chip-warning-bg text-chip-warning-fg" },
  changes_requested: { label: "Changes Requested", cls: "bg-chip-warning-bg text-chip-warning-fg" },
  approved: { label: "Approved", cls: "bg-chip-success-bg text-chip-success-fg" },
  rejected: { label: "Rejected", cls: "bg-chip-rejected-bg text-chip-rejected-fg" },
  spent: { label: "Approved", cls: "bg-chip-success-bg text-chip-success-fg" },
  closed: { label: "Approved", cls: "bg-chip-success-bg text-chip-success-fg" },
}

export function StatusBadge({ status }: { status: SpendRequestStatus }) {
  const { label, cls } = map[status]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide", cls)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
