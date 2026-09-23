import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/BackButton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ApprovalTable, useApprovalChecklist } from "@/components/ApprovalChecklist"
import {
  InitiativeBudgetDecidedNotice,
  InitiativeBudgetDecisionCard,
  isInitiativeBudgetPending,
  useInitiativeBudgetDecision,
} from "@/components/InitiativeBudgetDecision"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { formatMoney } from "@/lib/money"
import { useInitiative, useSubmitInitiative, useSubmitSpendRequestById } from "@/api/queries"
import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/AuthContext"
import { PENDING_DECISION_STATUSES } from "@/types/domain"

export default function InitiativeDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const canDecide = user?.role === "approver" || user?.role === "admin"
  const canAddSpend = user?.role === "member"
  const { data: initiative, isLoading, isError } = useInitiative(id)
  const submitInitiative = useSubmitInitiative(id)
  const submitSpendRequest = useSubmitSpendRequestById(id)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  // Called unconditionally (before the loading/error early returns below) so
  // hook order never changes between renders — falls back to an empty list
  // until the initiative has actually loaded.
  const pending = initiative?.spend_requests.filter((sr) => PENDING_DECISION_STATUSES.includes(sr.status)) ?? []
  const approvalChecklist = useApprovalChecklist(pending, id)
  const budgetDecision = useInitiativeBudgetDecision(id)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="my-2 h-10 w-full bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError || !initiative) {
    return (
      <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Couldn't load this initiative. It may not exist, or you may not have access to it.
      </div>
    )
  }

  const s = initiative.financial_summary
  const isOwner = initiative.owner.id === user?.id
  const draftSpendRequests = initiative.spend_requests.filter((sr) => sr.status === "draft")

  // The budget entered up front can drift from what's actually been broken
  // down into spend requests (some still to come, or the breakdown adds up
  // to more than planned) — flagged below so it's never silently invisible.
  const hasBreakdown = initiative.spend_requests.length > 0
  const budgetAmount = initiative.estimated_total_budget !== null ? Number(initiative.estimated_total_budget) : null
  const requestedAmount = Number(s.total_requested)
  const budgetMismatch = hasBreakdown && budgetAmount !== null && budgetAmount !== requestedAmount
  const budgetGap = budgetMismatch && budgetAmount !== null ? requestedAmount - budgetAmount : 0

  const openSubmitDialog = () => {
    if (draftSpendRequests.length === 0) {
      doSubmitInitiative([])
      return
    }
    setSelectedDraftIds(draftSpendRequests.map((sr) => sr.id))
    setSubmitDialogOpen(true)
  }

  const doSubmitInitiative = async (spendRequestIds: string[]) => {
    try {
      await submitInitiative.mutateAsync(spendRequestIds)
      setSubmitDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit this initiative.")
    }
  }

  const doSubmitOneSpendRequest = async (spendRequestId: string) => {
    try {
      await submitSpendRequest.mutateAsync(spendRequestId)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit this spend request.")
    }
  }

  const rest = canDecide
    ? initiative.spend_requests.filter((sr) => !PENDING_DECISION_STATUSES.includes(sr.status))
    : initiative.spend_requests

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackButton to={user?.role === "member" ? "/" : "/initiatives"} />
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {initiative.type ?? "Marketing Initiative"}
          </div>
          <h1 className="text-3xl font-bold">{initiative.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {initiative.location && <span>{initiative.location}</span>}
            {initiative.event_date && <span>{initiative.event_date}</span>}
            <InitiativeStatusBadge status={initiative.status} />
          </p>
          {initiative.objective && (
            <p className="mt-2 max-w-prose text-sm text-foreground">{initiative.objective}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && initiative.status === "draft" && (
            <Button onClick={openSubmitDialog} disabled={submitInitiative.isPending}>
              {submitInitiative.isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          )}
          {canDecide && pending.length > 0 && (
            <Button
              onClick={approvalChecklist.approve}
              disabled={approvalChecklist.selectedCount === 0 || approvalChecklist.isPending}
            >
              {approvalChecklist.isPending ? "Approving…" : "Approve"}
            </Button>
          )}
          {canAddSpend && (
            <Button asChild>
              <Link to={`/initiatives/${initiative.id}/spend-requests/new`}>
                <Plus className="size-4" /> Add Spend
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className={`mb-6 grid grid-cols-1 gap-3 ${budgetAmount !== null ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {budgetAmount !== null && (
          <SummaryTile label="Budget" value={formatMoney(initiative.estimated_total_budget, initiative.currency)} />
        )}
        <SummaryTile label="Requested" value={formatMoney(s.total_requested, initiative.currency)} />
        <SummaryTile label="Approved" value={formatMoney(s.total_approved, initiative.currency)} />
      </div>

      {budgetMismatch && (
        <div className="mb-6 border border-chip-warning-fg bg-chip-warning-bg px-4 py-3 text-sm text-chip-warning-fg">
          {budgetGap < 0
            ? `Budget was ${formatMoney(initiative.estimated_total_budget, initiative.currency)} — only ${formatMoney(s.total_requested, initiative.currency)} has been requested so far (${formatMoney(String(Math.abs(budgetGap)), initiative.currency)} not yet allocated to a spend request).`
            : `Budget was ${formatMoney(initiative.estimated_total_budget, initiative.currency)} — spend requests now total ${formatMoney(s.total_requested, initiative.currency)}, ${formatMoney(String(budgetGap), initiative.currency)} more than the approved budget.`}
        </div>
      )}

      {initiative.spend_requests.length === 0 ? (
        canDecide && isInitiativeBudgetPending(initiative) ? (
          <InitiativeBudgetDecisionCard initiative={initiative} state={budgetDecision} />
        ) : initiative.budget_decision ? (
          <InitiativeBudgetDecidedNotice initiative={initiative} />
        ) : (
          <div className="flex flex-col items-center gap-3 border border-border bg-card px-6 py-12 text-center">
            <h3 className="text-lg font-bold">This initiative doesn't have any spend yet.</h3>
            {!canDecide && isInitiativeBudgetPending(initiative) && (
              <p className="text-xs font-medium text-warning">Awaiting Siddharth's decision on the budget</p>
            )}
            {canAddSpend && (
              <>
                <p className="text-sm text-muted-foreground">Add the first spend request for this initiative.</p>
                <Button asChild variant="outline">
                  <Link to={`/initiatives/${initiative.id}/spend-requests/new`}>+ Add Spend</Link>
                </Button>
              </>
            )}
          </div>
        )
      ) : (
        <>
          {canDecide && pending.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-bold">Awaiting Decision</h2>
              <p className="mb-2 text-xs text-muted-foreground">
                Everything's selected by default — untick anything to leave it pending, add a remark where it helps.
              </p>
              <div className="border border-border bg-card">
                <ApprovalTable spendRequests={pending} state={approvalChecklist} />
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-bold">Spend Requests</h2>
              <div className="border border-border bg-card">
                <Table className="hidden lg:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Approval Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rest.map((sr, i) => {
                      const awaitingDecision = !canDecide && PENDING_DECISION_STATUSES.includes(sr.status)
                      // Submitting a lone spend request only makes sense once the initiative
                      // itself is published — otherwise it'd land in Siddharth's queue with
                      // no visible initiative behind it (the backend also enforces this).
                      const canSubmitThis =
                        sr.status === "draft" && sr.created_by.id === user?.id && initiative.status !== "draft"
                      return (
                        <TableRow key={sr.id} className={awaitingDecision ? "bg-warning/10" : undefined}>
                          <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                              {sr.description}
                            </Link>
                            {sr.other_description && (
                              <div className="mt-0.5 max-w-72 truncate text-xs text-foreground" title={sr.other_description}>
                                {sr.other_description}
                              </div>
                            )}
                            {awaitingDecision && (
                              <div className="text-xs font-medium text-warning">Awaiting Siddharth's decision</div>
                            )}
                            {canSubmitThis && (
                              <div className="mt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => doSubmitOneSpendRequest(sr.id)}
                                  disabled={submitSpendRequest.isPending}
                                >
                                  Submit for Approval
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{sr.category.name}</TableCell>
                          <TableCell className="tabular-nums">{formatMoney(sr.requested_amount, initiative.currency)}</TableCell>
                          <TableCell>{sr.latest_decision_comment ?? "—"}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-3 p-3 lg:hidden">
                  {rest.map((sr, i) => {
                    const awaitingDecision = !canDecide && PENDING_DECISION_STATUSES.includes(sr.status)
                    const canSubmitThis =
                      sr.status === "draft" && sr.created_by.id === user?.id && initiative.status !== "draft"
                    return (
                      <MobileRow key={sr.id} className={awaitingDecision ? "bg-warning/10" : undefined}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                          <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                            {sr.description}
                          </Link>
                        </div>
                        {sr.other_description && <p className="text-xs text-foreground">{sr.other_description}</p>}
                        {awaitingDecision && (
                          <div className="text-xs font-medium text-warning">Awaiting Siddharth's decision</div>
                        )}
                        <MobileField label="Category">{sr.category.name}</MobileField>
                        <MobileField label="Amount">{formatMoney(sr.requested_amount, initiative.currency)}</MobileField>
                        <MobileField label="Remarks">{sr.latest_decision_comment ?? "—"}</MobileField>
                        {canSubmitThis && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1"
                            onClick={() => doSubmitOneSpendRequest(sr.id)}
                            disabled={submitSpendRequest.isPending}
                          >
                            Submit for Approval
                          </Button>
                        )}
                      </MobileRow>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit "{initiative.name}" for approval?</DialogTitle>
            <DialogDescription>
              This initiative has {draftSpendRequests.length} spend request{draftSpendRequests.length === 1 ? "" : "s"} still
              in draft. Anything checked below gets submitted for approval along with the initiative; anything you
              uncheck stays a draft, submittable later on its own.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 border border-border">
            {draftSpendRequests.map((sr) => {
              const checked = selectedDraftIds.includes(sr.id)
              return (
                <label
                  key={sr.id}
                  className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setSelectedDraftIds((ids) =>
                          value ? [...ids, sr.id] : ids.filter((existingId) => existingId !== sr.id),
                        )
                      }
                    />
                    {sr.description}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(sr.requested_amount, initiative.currency)}
                  </span>
                </label>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} disabled={submitInitiative.isPending}>
              Cancel
            </Button>
            <Button onClick={() => doSubmitInitiative(selectedDraftIds)} disabled={submitInitiative.isPending}>
              {submitInitiative.isPending ? "Submitting…" : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
