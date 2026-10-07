import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InitiativeForm } from "@/components/InitiativeForm"
import { deriveOutcome } from "@/components/InitiativeStatusBadge"
import { BackButton } from "@/components/BackButton"
import { StatusBadge } from "@/components/StatusBadge"
import { InlineAddSpend } from "@/components/InlineAddSpend"
import { EditableSpendRequestRow } from "@/components/EditableSpendRequestRow"
import { useCategories, useInitiative, useSubmitInitiative, useUpdateInitiative } from "@/api/queries"
import { formatMoney } from "@/lib/money"
import { EDITABLE_SPEND_STATUSES } from "@/types/domain"

export default function EditInitiative() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: initiative, isLoading, isError } = useInitiative(id)
  const updateInitiative = useUpdateInitiative(id)
  const submitInitiative = useSubmitInitiative(id)
  const { data: categories, isLoading: categoriesLoading } = useCategories()
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

  const editable = initiative.spend_requests.filter((sr) => EDITABLE_SPEND_STATUSES.includes(sr.status))
  const lockedSpendRequests = initiative.spend_requests.filter((sr) => !EDITABLE_SPEND_STATUSES.includes(sr.status))

  // Category/Currency/Total Budget only freeze once an approver has actually
  // decided (approved, partially approved, or rejected) — merely being
  // submitted and awaiting a decision still leaves them editable.
  const fieldsLocked = ["approved", "rejected", "partial"].includes(deriveOutcome(initiative))
  // The backend's bundle-submit endpoint (POST /initiatives/{id}/submit) only
  // ever works while the initiative itself is still "draft" — a one-shot
  // action, distinct from whether the top-line fields are locked.
  const canBundleSubmit = initiative.status === "draft"

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4">
        <BackButton to={`/initiatives/${id}`} label={initiative.name} />
        <h1 className="text-3xl font-bold">Edit Request</h1>
      </div>

      <InitiativeForm
        initial={{
          name: initiative.name,
          type: initiative.type,
          currency: initiative.currency,
          objective: initiative.objective,
          estimated_total_budget: initiative.estimated_total_budget,
        }}
        submitLabel={initiative.status === "draft" ? "Save as Draft" : "Save Changes"}
        pendingLabel="Saving…"
        locked={fieldsLocked}
        onCancel={() => navigate(`/initiatives/${id}`)}
        onSubmit={async (payload) => {
          await updateInitiative.mutateAsync(payload)
          navigate(`/initiatives/${id}`)
        }}
        secondaryAction={
          canBundleSubmit
            ? {
                label: "Submit for Approval",
                pendingLabel: "Submitting…",
                onSubmit: async (payload) => {
                  await updateInitiative.mutateAsync(payload)
                  await submitInitiative.mutateAsync(editable.map((sr) => sr.id))
                  navigate(`/initiatives/${id}`)
                },
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Spend Breakdown</h3>

          {lockedSpendRequests.length > 0 && (
            <div className="flex flex-col gap-2">
              {lockedSpendRequests.map((sr) => (
                <div key={sr.id} className="flex items-center justify-between gap-3 border border-border bg-muted/30 p-3">
                  <div>
                    <div className="text-sm font-medium">{sr.description ?? sr.category.name}</div>
                    <div className="text-xs text-muted-foreground">{sr.category.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm">{formatMoney(sr.requested_amount, sr.currency)}</span>
                    <StatusBadge status={sr.status} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Already submitted — financial details are locked. Add a new spend request below for anything more.
              </p>
            </div>
          )}

          {editable.length > 0 && (
            <div className="flex flex-col gap-2">
              {editable.map((sr) => (
                <EditableSpendRequestRow
                  key={sr.id}
                  spendRequest={sr}
                  initiativeId={initiative.id}
                  categories={categories}
                  categoriesLoading={categoriesLoading}
                  canSubmit={initiative.status !== "draft"}
                  initiativeCurrency={initiative.currency}
                />
              ))}
            </div>
          )}

          {addSpendOpen ? (
            <InlineAddSpend
              initiativeId={initiative.id}
              currency={initiative.currency}
              onClose={() => setAddSpendOpen(false)}
            />
          ) : (
            <Button type="button" variant="outline" className="self-start" onClick={() => setAddSpendOpen(true)}>
              <Plus className="size-4" /> Add Spend
            </Button>
          )}
        </div>
      </InitiativeForm>
    </div>
  )
}
