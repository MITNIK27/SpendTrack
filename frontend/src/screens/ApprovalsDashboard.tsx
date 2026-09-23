import { useMemo } from "react"
import { ClipboardCheck } from "lucide-react"
import { ApprovalChecklist } from "@/components/ApprovalChecklist"
import { isInitiativeBudgetPending, PendingInitiativeBudgetRow } from "@/components/InitiativeBudgetDecision"
import { useInitiatives, useSpendRequests } from "@/api/queries"
import { PENDING_DECISION_STATUSES } from "@/types/domain"

export default function ApprovalsDashboard() {
  const { data: spendRequests, isLoading, isError } = useSpendRequests()
  const { data: initiatives } = useInitiatives()
  const initiativeNames = useMemo(
    () => new Map((initiatives ?? []).map((i) => [i.id, i.name])),
    [initiatives],
  )

  const pending = useMemo(
    () => (spendRequests ?? []).filter((sr) => PENDING_DECISION_STATUSES.includes(sr.status)),
    [spendRequests],
  )

  const pendingBudgets = useMemo(
    () => (initiatives ?? []).filter(isInitiativeBudgetPending),
    [initiatives],
  )

  const nothingPending = pending.length === 0 && pendingBudgets.length === 0

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Approvals</div>
        <h1 className="text-3xl font-bold">Pending Approvals</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Select what to approve, add a remark if it's worth one, and click Approve.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="my-2 h-10 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Couldn't load pending approvals.
        </div>
      )}

      {!isLoading && !isError && nothingPending && (
        <div className="flex flex-col items-center gap-3 border border-border bg-card px-6 py-16 text-center">
          <div className="grid size-12 place-items-center bg-secondary">
            <ClipboardCheck className="size-6 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-bold">You're all caught up.</h3>
            <p className="text-sm text-muted-foreground">
              No marketing spend requests need your approval right now.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && pendingBudgets.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Initiative Budgets Awaiting Approval</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            These initiatives have no spend breakdown of their own — their whole requested budget is what's being
            decided.
          </p>
          <div className="border border-border bg-card">
            {pendingBudgets.map((initiative) => (
              <PendingInitiativeBudgetRow key={initiative.id} initiative={initiative} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && pending.length > 0 && (
        <ApprovalChecklist spendRequests={pending} initiativeNames={initiativeNames} />
      )}
    </div>
  )
}
