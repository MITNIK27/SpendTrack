import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/BackButton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ApprovalTable, RejectConfirmDialog, useApprovalChecklist } from "@/components/ApprovalChecklist"
import {
  InitiativeBudgetDecidedNotice,
  InitiativeBudgetDecisionCard,
  isInitiativeBudgetPending,
  useInitiativeBudgetDecision,
} from "@/components/InitiativeBudgetDecision"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { StatusBadge } from "@/components/StatusBadge"
import { InlineAddSpend } from "@/components/InlineAddSpend"
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
  const [addSpendOpen, setAddSpendOpen] = useState(false)

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
        Couldn't load this request. It may not exist, or you may not have access to it.
      </div>
    )
  }

  const s = initiative.financial_summary
  // Editing is a member-only action (`initiatives/:id/edit` is gated by
  // MemberRoute) — checking ownership alone isn't enough, since an approver
  // can also be an initiative's owner (e.g. one they submitted before taking
  // on that role) and would otherwise see an Edit button that just bounces
  // them back out via that route guard.
  const isOwner = initiative.owner.id === user?.id && user?.role === "member"
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
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit this request.")
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <BackButton to={user?.role === "member" ? "/" : "/initiatives"} />
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {initiative.type ?? "Marketing Request"}
          </div>
          <h1 className="text-3xl font-bold">{initiative.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {initiative.location && <span>{initiative.location}</span>}
            {initiative.event_date && <span>{initiative.event_date}</span>}
            <InitiativeStatusBadge initiative={initiative} />
          </p>
          {initiative.objective && (
            <p className="mt-2 max-w-prose text-sm text-foreground">{initiative.objective}</p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-muted-foreground">Submitted by {initiative.owner.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <Button asChild variant="outline">
                <Link to={`/initiatives/${initiative.id}/edit`}>
                  <Pencil className="size-4" /> Edit
                </Link>
              </Button>
            )}
            {isOwner && initiative.status === "draft" && (
              <Button onClick={openSubmitDialog} disabled={submitInitiative.isPending}>
                {submitInitiative.isPending ? "Submitting…" : "Submit for Approval"}
              </Button>
            )}
            {canDecide && pending.length > 0 && (
              <>
                <Button
                  onClick={approvalChecklist.approve}
                  disabled={approvalChecklist.selectedCount === 0 || approvalChecklist.isPending}
                >
                  {approvalChecklist.isPending ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  onClick={approvalChecklist.openRejectDialog}
                  disabled={approvalChecklist.selectedCount === 0 || approvalChecklist.isPending}
                >
                  Reject
                </Button>
              </>
            )}
            {canAddSpend && !addSpendOpen && (
              <Button onClick={() => setAddSpendOpen(true)}>
                <Plus className="size-4" /> Add Spend
              </Button>
            )}
          </div>
        </div>
      </div>

      {addSpendOpen && (
        <InlineAddSpend
          initiativeId={initiative.id}
          currency={initiative.currency}
          onClose={() => setAddSpendOpen(false)}
        />
      )}

      <div className={`mb-6 grid grid-cols-1 gap-3 ${budgetAmount !== null ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {budgetAmount !== null && (
          <SummaryTile label="Total Budget" value={formatMoney(initiative.estimated_total_budget, initiative.currency)} />
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
            <h3 className="text-lg font-bold">This request doesn't have any spend yet.</h3>
            {!canDecide && isInitiativeBudgetPending(initiative) && (
              <p className="text-xs font-medium text-warning">Awaiting approval on the budget</p>
            )}
            {canAddSpend && !addSpendOpen && (
              <>
                <p className="text-sm text-muted-foreground">Add the first spend request for it.</p>
                <Button variant="outline" onClick={() => setAddSpendOpen(true)}>+ Add Spend</Button>
              </>
            )}
          </div>
        )
      ) : (
        <>
          {canDecide && pending.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-lg font-bold">Awaiting Decision</h2>
              <div className="border border-border bg-card">
                <ApprovalTable spendRequests={pending} state={approvalChecklist} hideRequestedBy />
              </div>
              <RejectConfirmDialog state={approvalChecklist} spendRequests={pending} initiativeName={initiative.name} />
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-bold">Spend Breakdown</h2>
              <div className="border border-border bg-card">
                <Table className="hidden table-fixed lg:table">
                  <TableHeader className="bg-muted/60">
                    <TableRow className="divide-x divide-border">
                      <TableHead className="w-[28%]">Description</TableHead>
                      <TableHead className="w-[16%]">Category</TableHead>
                      <TableHead className="w-[11%]">Amount</TableHead>
                      <TableHead className="w-[28%]">Status</TableHead>
                      <TableHead className="w-[17%]">Approval Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rest.map((sr) => {
                      const awaitingDecision = !canDecide && PENDING_DECISION_STATUSES.includes(sr.status)
                      // Submitting (or resubmitting) a lone spend request only makes sense once
                      // the initiative itself is published — otherwise it'd land in the queue
                      // with no visible initiative behind it (the backend also enforces this).
                      const canSubmitThis =
                        (sr.status === "draft" || sr.status === "changes_requested") &&
                        sr.created_by.id === user?.id &&
                        initiative.status !== "draft"
                      return (
                        <TableRow key={sr.id} className={awaitingDecision ? "bg-warning/10" : undefined}>
                          <TableCell className="align-top whitespace-normal">
                            <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                              {sr.description}
                            </Link>
                            {sr.other_description && (
                              <div className="mt-0.5 truncate text-xs text-foreground" title={sr.other_description}>
                                {sr.other_description}
                              </div>
                            )}
                            {awaitingDecision && (
                              <div className="text-xs font-medium text-warning">Awaiting approval</div>
                            )}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal">{sr.category.name}</TableCell>
                          <TableCell className="align-top tabular-nums">{formatMoney(sr.requested_amount, sr.currency)}</TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge status={sr.status} />
                              {canSubmitThis && (
                                <Button
                                  size="xs"
                                  onClick={() => doSubmitOneSpendRequest(sr.id)}
                                  disabled={submitSpendRequest.isPending}
                                >
                                  {sr.status === "changes_requested" ? "Resubmit" : "Submit"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top whitespace-normal">{sr.latest_decision_comment ?? "—"}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-3 p-3 lg:hidden">
                  {rest.map((sr) => {
                    const awaitingDecision = !canDecide && PENDING_DECISION_STATUSES.includes(sr.status)
                    const canSubmitThis =
                      (sr.status === "draft" || sr.status === "changes_requested") &&
                      sr.created_by.id === user?.id &&
                      initiative.status !== "draft"
                    return (
                      <MobileRow key={sr.id} className={awaitingDecision ? "bg-warning/10" : undefined}>
                        <div className="flex items-baseline gap-2">
                          <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                            {sr.description}
                          </Link>
                        </div>
                        {sr.other_description && <p className="text-xs text-foreground">{sr.other_description}</p>}
                        {awaitingDecision && (
                          <div className="text-xs font-medium text-warning">Awaiting approval</div>
                        )}
                        <MobileField label="Category">{sr.category.name}</MobileField>
                        <MobileField label="Amount">{formatMoney(sr.requested_amount, sr.currency)}</MobileField>
                        <MobileField label="Status">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={sr.status} />
                            {canSubmitThis && (
                              <Button
                                size="xs"
                                onClick={() => doSubmitOneSpendRequest(sr.id)}
                                disabled={submitSpendRequest.isPending}
                              >
                                {sr.status === "changes_requested" ? "Resubmit" : "Submit"}
                              </Button>
                            )}
                          </div>
                        </MobileField>
                        <MobileField label="Remarks">{sr.latest_decision_comment ?? "—"}</MobileField>
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
              This request has {draftSpendRequests.length} spend request{draftSpendRequests.length === 1 ? "" : "s"} still
              saved as a draft. Anything checked below gets submitted for approval along with the request; anything you
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
                    {formatMoney(sr.requested_amount, sr.currency)}
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
