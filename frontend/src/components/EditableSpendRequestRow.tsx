import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody } from "@/components/ui/table"
import {
  SpendBreakdownFields,
  buildSpendRequestPayload,
  validateSpendBreakdown,
  type SpendBreakdownValue,
} from "@/components/SpendBreakdownFields"
import { useSubmitSpendRequestById, useUpdateSpendRequest } from "@/api/queries"
import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/AuthContext"
import type { Currency } from "@/lib/money"
import type { Category, SpendRequest } from "@/types/domain"

function toValue(sr: SpendRequest): SpendBreakdownValue {
  return {
    categoryId: sr.category.id,
    subcategoryId: sr.subcategory?.id ?? "",
    otherDescription: sr.other_description ?? "",
    requestedAmount: String(sr.requested_amount),
    currency: sr.currency,
  }
}

function isSameValue(a: SpendBreakdownValue, b: SpendBreakdownValue): boolean {
  return (
    a.categoryId === b.categoryId &&
    a.subcategoryId === b.subcategoryId &&
    a.otherDescription === b.otherDescription &&
    a.requestedAmount === b.requestedAmount &&
    a.currency === b.currency
  )
}

interface Props {
  spendRequest: SpendRequest
  initiativeId: string
  categories: Category[] | undefined
  categoriesLoading?: boolean
  /** True once the parent request is no longer a draft — mirrors the backend's
   * own precondition on POST /spend-requests/{id}/submit, which 409s while the
   * parent initiative is still "draft" (it must be submitted as a bundle first). */
  canSubmit?: boolean
  /** The parent request's own currency — passed through to SpendBreakdownFields
   * for its conversion-hint comparison. */
  initiativeCurrency: Currency
}

/** One existing draft/changes_requested spend request, editable in place —
 * pre-filled from its current values, saved only when actually changed.
 * Financial edits on anything past these two statuses are locked server-side
 * (spend_request_service.update, EDITABLE_STATUSES) — this component is only
 * ever rendered for a row already confirmed editable by the caller. */
export function EditableSpendRequestRow({ spendRequest, initiativeId, categories, categoriesLoading, canSubmit, initiativeCurrency }: Props) {
  const { user } = useAuth()
  const original = toValue(spendRequest)
  const [value, setValue] = useState<SpendBreakdownValue>(original)
  const [error, setError] = useState<string | null>(null)
  const updateSpendRequest = useUpdateSpendRequest(spendRequest.id, initiativeId)
  const submitSpendRequest = useSubmitSpendRequestById(initiativeId)

  const dirty = !isSameValue(value, original)
  const isResubmit = spendRequest.status === "changes_requested"
  const showSubmit = !!canSubmit && spendRequest.created_by.id === user?.id

  const save = async () => {
    setError(null)
    const category = categories?.find((c) => c.id === value.categoryId)
    const err = validateSpendBreakdown(value, category)
    if (err) {
      setError(err)
      return
    }
    try {
      await updateSpendRequest.mutateAsync(buildSpendRequestPayload(value))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this spend request.")
    }
  }

  const submit = async () => {
    setError(null)
    try {
      await submitSpendRequest.mutateAsync(spendRequest.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit this spend request.")
    }
  }

  return (
    <div className="border border-border bg-card p-3">
      {spendRequest.status === "changes_requested" && spendRequest.latest_decision_comment && (
        <p className="mb-2 text-xs text-chip-warning-fg">
          Changes requested: "{spendRequest.latest_decision_comment}"
        </p>
      )}
      <Table className="table-fixed">
        <TableBody>
          <SpendBreakdownFields
            value={value}
            onChange={setValue}
            categories={categories}
            categoriesLoading={categoriesLoading}
            initiativeCurrency={initiativeCurrency}
          />
        </TableBody>
      </Table>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={save}
          disabled={!dirty || updateSpendRequest.isPending}
        >
          {updateSpendRequest.isPending ? "Saving…" : "Save"}
        </Button>
        {showSubmit && (
          <Button type="button" size="sm" onClick={submit} disabled={submitSpendRequest.isPending}>
            {submitSpendRequest.isPending ? "Submitting…" : isResubmit ? "Resubmit" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  )
}
