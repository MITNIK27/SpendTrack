import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/money"
import { useDecideInitiativeBudget } from "@/api/queries"
import { ApiError } from "@/api/client"
import type { Initiative } from "@/types/domain"

/** True only for an initiative that's actually awaiting its own budget
 * decision — one with zero spend-breakdown rows of its own (a breakdown is
 * decided per-line instead), already submitted, with a budget amount, and
 * not yet decided. */
export function isInitiativeBudgetPending(initiative: Initiative): boolean {
  return (
    initiative.spend_request_count === 0 &&
    initiative.status !== "draft" &&
    !!initiative.estimated_total_budget &&
    !initiative.budget_decision
  )
}

export function useInitiativeBudgetDecision(initiativeId: string | undefined) {
  const [remark, setRemark] = useState("")
  const decide = useDecideInitiativeBudget(initiativeId)

  const act = async (action: "approve" | "reject") => {
    try {
      await decide.mutateAsync({ action, comment: remark.trim() || null })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Couldn't ${action} this initiative's budget.`)
    }
  }

  return { remark, setRemark, approve: () => act("approve"), reject: () => act("reject"), isPending: decide.isPending }
}

interface Props {
  initiative: Initiative
  state: ReturnType<typeof useInitiativeBudgetDecision>
  /** Compact single-row layout for a list of many pending initiatives (the
   * Approvals dashboard) instead of the larger standalone card (Initiative
   * Detail). */
  compact?: boolean
}

/** The "Initiative Budget Awaiting Approval" card/row — deliberately not
 * labeled "Awaiting Decision" (that heading means a real spend-breakdown
 * line item) so an approver never mistakes one for the other. */
export function InitiativeBudgetDecisionCard({ initiative, state, compact }: Props) {
  return (
    <div
      className={
        compact
          ? "flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col items-center gap-3 border border-border bg-card px-6 py-10 text-center"
      }
    >
      <div className={compact ? "flex-1" : undefined}>
        {!compact && <h3 className="text-lg font-bold">Initiative Budget Awaiting Approval</h3>}
        <p className={compact ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
          {compact && <span className="font-semibold">{initiative.name}</span>}
          {compact && " — "}
          No spend breakdown was provided — the requested amount is{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(initiative.estimated_total_budget, initiative.currency)}
          </span>
          .
        </p>
        <p className="text-xs text-muted-foreground">Created by {initiative.owner.name}</p>
      </div>
      <div className={compact ? "flex items-center gap-2" : "flex w-full max-w-sm flex-col items-stretch gap-2 sm:flex-row"}>
        <Input
          value={state.remark}
          onChange={(e) => state.setRemark(e.target.value)}
          placeholder="Remark (optional)"
          aria-label="Remark"
          className="bg-card"
        />
        <div className="flex gap-2">
          <Button onClick={state.approve} disabled={state.isPending}>
            {state.isPending ? "Saving…" : "Approve"}
          </Button>
          <Button size="sm" variant="outline" onClick={state.reject} disabled={state.isPending}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}

/** One row in a list of many pending-budget initiatives (the Approvals
 * dashboard) — owns its own decision state, since each row's mutation is
 * independent of the others'. */
export function PendingInitiativeBudgetRow({ initiative }: { initiative: Initiative }) {
  const state = useInitiativeBudgetDecision(initiative.id)
  return <InitiativeBudgetDecisionCard initiative={initiative} state={state} compact />
}

/** Read-only state once an initiative's budget has been decided — mirrors
 * how a decided SpendRequest shows its latest decision comment elsewhere. */
export function InitiativeBudgetDecidedNotice({ initiative }: { initiative: Initiative }) {
  const approved = initiative.budget_decision === "approved"
  return (
    <div className="flex flex-col items-center gap-1 border border-border bg-card px-6 py-10 text-center">
      <h3 className="text-lg font-bold">
        {approved ? "Budget approved" : "Budget rejected"} —{" "}
        {formatMoney(initiative.estimated_total_budget, initiative.currency)}
      </h3>
      {initiative.budget_decision_comment && (
        <p className="text-sm text-muted-foreground">"{initiative.budget_decision_comment}"</p>
      )}
    </div>
  )
}
