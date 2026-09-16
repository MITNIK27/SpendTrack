import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/BackButton"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/StatusBadge"
import { TeamMemberChips } from "@/components/TeamMemberPicker"
import { currencySymbol, formatMoney } from "@/lib/money"
import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/AuthContext"
import {
  useInitiative,
  useRecordActualSpend,
  useSpendRequest,
  useSpendRequestActivity,
  useSubmitSpendRequest,
} from "@/api/queries"
import type { SpendRequest } from "@/types/domain"
import { useState } from "react"

export default function SpendRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const canSeeActivity = user?.role === "approver" || user?.role === "admin"
  const canRecordActual = user?.role === "admin"
  const { data: sr, isLoading, isError } = useSpendRequest(id)
  const { data: initiative } = useInitiative(sr?.initiative_id)
  const { data: activity } = useSpendRequestActivity(id, canSeeActivity)
  const submit = useSubmitSpendRequest(id ?? "", sr?.initiative_id)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) {
    return <div className="my-2 h-40 w-full bg-muted motion-safe:animate-pulse" />
  }
  if (isError || !sr) {
    return (
      <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Couldn't load this spend request.
      </div>
    )
  }

  const doSubmit = async () => {
    setError(null)
    try {
      await submit.mutateAsync()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit this spend request.")
    }
  }

  const variance = sr.variance !== null ? Number(sr.variance) : null

  return (
    <div className="mx-auto max-w-[840px]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <BackButton to={`/initiatives/${sr.initiative_id}`} label="Back to Initiative" />
          <h1 className="mt-1 text-3xl font-bold">{sr.description ?? sr.category.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sr.category.code}. {sr.category.name}{sr.subcategory ? ` — ${sr.subcategory.name}` : ""}
          </p>
        </div>
        <StatusBadge status={sr.status} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryTile label="Requested" value={formatMoney(sr.requested_amount, sr.currency)} />
        <SummaryTile label="Approved" value={formatMoney(sr.approved_amount, sr.currency)} />
        <SummaryTile label="Actual" value={formatMoney(sr.actual_amount, sr.currency)} />
      </div>

      {variance !== null && variance !== 0 && (
        <div className={`mb-6 border px-4 py-3 text-sm ${variance < 0 ? "border-chip-warning-fg bg-chip-warning-bg text-chip-warning-fg" : "border-chip-success-fg bg-chip-success-bg text-chip-success-fg"}`}>
          {variance < 0
            ? `Approved for ${formatMoney(sr.approved_amount)} — ${formatMoney(Math.abs(variance))} less than requested.`
            : `Approved for ${formatMoney(sr.approved_amount)} — ${formatMoney(variance)} more than requested.`}
        </div>
      )}

      {(sr.vendor || sr.other_description || sr.line_items.length > 0 || sr.team_members.length > 0) && (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {sr.vendor && (
              <div className="col-span-2"><ReviewRow label="Vendor" value={sr.vendor} /></div>
            )}
            {sr.other_description && (
              <div className="col-span-2"><ReviewRow label="Description of spend" value={sr.other_description} /></div>
            )}
            {sr.line_items.length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Spend Breakdown</dt>
                <dd className="mt-1 flex flex-col gap-1">
                  {sr.line_items.map((li) => (
                    <div key={li.id} className="flex justify-between">
                      <span>{li.item}</span>
                      <span>{formatMoney(li.amount)}</span>
                    </div>
                  ))}
                </dd>
              </div>
            )}
            {sr.team_members.length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Team Members</dt>
                <dd className="mt-1"><TeamMemberChips members={sr.team_members} /></dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      )}

      {sr.status === "draft" && !!initiative && initiative.status !== "draft" && (
        <div className="mb-6 flex items-center gap-3">
          <Button onClick={doSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit for Approval"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {sr.status === "draft" && initiative?.status === "draft" && (
        <p className="mb-6 text-xs text-muted-foreground">
          Submit "{initiative.name}" for approval to send this along with it.
        </p>
      )}

      {canRecordActual && sr.status === "approved" && <ActualSpendPanel spendRequest={sr} />}

      {canSeeActivity && (
        <>
          <h2 className="mb-3 text-lg font-bold">Activity</h2>
          <div className="border border-border bg-card">
            {!activity || activity.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((entry) => {
                  const comment = entry.log_metadata?.comment
                  return (
                    <li key={entry.id} className="px-4 py-3 text-sm">
                      <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>{" — "}
                      <span className="font-medium">{entry.actor?.display_name ?? "System"}</span>{" "}
                      {actionLabel(entry.action)}
                      {typeof comment === "string" && comment && (
                        <p className="mt-1 text-muted-foreground">"{comment}"</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    spend_created: "created this spend request",
    spend_edited: "edited this spend request",
    spend_submitted: "submitted this request for approval",
    spend_resubmitted: "resubmitted this request",
    spend_approved: "approved this request",
    spend_approved_different_amount: "approved this request for a different amount",
    spend_rejected: "rejected this request",
    spend_changes_requested: "requested changes",
    actual_recorded: "recorded the actual spend",
  }
  return labels[action] ?? action.replaceAll("_", " ")
}

function ActualSpendPanel({ spendRequest }: { spendRequest: SpendRequest }) {
  const recordActual = useRecordActualSpend(spendRequest.id, spendRequest.initiative_id)
  const [amount, setAmount] = useState(spendRequest.approved_amount ?? "")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const numericAmount = Number(amount)
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid actual spend amount.")
      return
    }
    try {
      await recordActual.mutateAsync({
        actual_amount: numericAmount,
        actual_spend_date: date ? new Date(date).toISOString() : undefined,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record actual spend.")
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <h2 className="text-lg font-bold">Record Actual Spend</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-2">
            <Label htmlFor="actualAmount">Actual Amount ({currencySymbol(spendRequest.currency)}) *</Label>
            <Input
              id="actualAmount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex max-w-xs flex-1 flex-col gap-2">
            <Label htmlFor="actualSpendDate">Spend Date</Label>
            <Input id="actualSpendDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div>
          <Button onClick={submit} disabled={recordActual.isPending}>
            {recordActual.isPending ? "Recording…" : "Record Actual Spend"}
          </Button>
        </div>
      </CardContent>
    </Card>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  )
}
