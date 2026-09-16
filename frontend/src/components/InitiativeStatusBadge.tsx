import { cn } from "@/lib/utils"
import type { InitiativeStatus } from "@/types/domain"

const map: Record<InitiativeStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  active: { label: "Active", cls: "bg-chip-success-bg text-chip-success-fg" },
  closed: { label: "Closed", cls: "bg-chip-warning-bg text-chip-warning-fg" },
  archived: { label: "Archived", cls: "bg-muted text-muted-foreground" },
}

export function InitiativeStatusBadge({ status }: { status: InitiativeStatus }) {
  const { label, cls } = map[status]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide", cls)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
