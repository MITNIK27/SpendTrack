import { useMemo, useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { ApprovalChecklist } from "@/components/ApprovalChecklist"
import { isInitiativeBudgetPending, PendingInitiativeBudgetRow } from "@/components/InitiativeBudgetDecision"
import { useInitiatives, useSpendRequests } from "@/api/queries"
import { PENDING_DECISION_STATUSES, type SpendRequestStatus } from "@/types/domain"

type AmountSort = "asc" | "desc" | null
const NEXT_AMOUNT_SORT: Record<NonNullable<AmountSort> | "none", AmountSort> = { none: "asc", asc: "desc", desc: null }

export default function ApprovalsDashboard() {
  const { data: spendRequests, isLoading, isError } = useSpendRequests()
  const { data: initiatives } = useInitiatives()
  const [statusFilter, setStatusFilter] = useState<SpendRequestStatus | "all">("all")
  const [reportedByFilter, setReportedByFilter] = useState<string>("")
  const [reportedByLabel, setReportedByLabel] = useState<string | undefined>(undefined)
  const [reportedByQuery, setReportedByQuery] = useState("")
  const [amountSort, setAmountSort] = useState<AmountSort>(null)
  const initiativeNames = useMemo(
    () => new Map((initiatives ?? []).map((i) => [i.id, i.name])),
    [initiatives],
  )

  const allPending = useMemo(
    () => (spendRequests ?? []).filter((sr) => PENDING_DECISION_STATUSES.includes(sr.status)),
    [spendRequests],
  )

  const reporters = useMemo(
    () => [...new Map(allPending.map((sr) => [sr.created_by.id, sr.created_by.name])).entries()],
    [allPending],
  )

  const statusOptions = [
    { value: "all" as const, label: "All", count: allPending.length },
    ...PENDING_DECISION_STATUSES.map((s) => ({
      value: s,
      label: s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
      count: allPending.filter((sr) => sr.status === s).length,
      dotClassName: "bg-chip-active-fg",
    })),
  ]

  // Nothing shown until a query is actually typed — search-and-it-comes-up,
  // not a browsable dropdown of every reporter (matches the Dashboard's
  // Requester filter, RequesterCombobox.tsx).
  const reportedByOptions = useMemo(() => {
    const q = reportedByQuery.trim().toLowerCase()
    if (!q) return []
    return reporters.filter(([, name]) => name.toLowerCase().includes(q)).map(([id, name]) => ({ id, label: name }))
  }, [reporters, reportedByQuery])

  const changeReportedBy = (id: string, label?: string) => {
    setReportedByFilter(id)
    setReportedByLabel(label)
  }

  const pending = useMemo(() => {
    const filtered = allPending
      .filter((sr) => statusFilter === "all" || sr.status === statusFilter)
      .filter((sr) => !reportedByFilter || sr.created_by.id === reportedByFilter)
    if (!amountSort) return filtered
    return [...filtered].sort((a, b) => {
      const diff = Number(a.requested_amount) - Number(b.requested_amount)
      return amountSort === "asc" ? diff : -diff
    })
  }, [allPending, statusFilter, reportedByFilter, amountSort])

  const pendingBudgets = useMemo(
    () => (initiatives ?? []).filter(isInitiativeBudgetPending),
    [initiatives],
  )

  const nothingPending = allPending.length === 0 && pendingBudgets.length === 0
  const nothingMatchesFilter = !nothingPending && pending.length === 0 && pendingBudgets.length === 0

  return (
    <div>
      <div className="mb-6">
        {/* <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Approvals</div> */}
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

      {!isLoading && !isError && nothingMatchesFilter && (
        <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </div>
      )}

      {!isLoading && !isError && pendingBudgets.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Request Budgets Awaiting Approval</h2>
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
        <ApprovalChecklist
          spendRequests={pending}
          initiativeNames={initiativeNames}
          controls={{
            status: { value: statusFilter, onChange: setStatusFilter, options: statusOptions },
            reportedBy: {
              value: reportedByFilter,
              onChange: changeReportedBy,
              query: reportedByQuery,
              onQueryChange: setReportedByQuery,
              options: reportedByOptions,
              selectedLabel: reportedByLabel,
            },
            amountSort: {
              direction: amountSort,
              onClick: () => setAmountSort(NEXT_AMOUNT_SORT[amountSort ?? "none"]),
            },
          }}
        />
      )}
    </div>
  )
}
