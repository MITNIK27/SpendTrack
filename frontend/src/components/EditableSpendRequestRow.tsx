import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody } from "@/components/ui/table"
import {
  SpendBreakdownFields,
  buildSpendRequestPayload,
  validateSpendBreakdown,
  type SpendBreakdownValue,
} from "@/components/SpendBreakdownFields"
import { useUpdateSpendRequest } from "@/api/queries"
import { ApiError } from "@/api/client"
import type { Category, SpendRequest } from "@/types/domain"

function toValue(sr: SpendRequest): SpendBreakdownValue {
  return {
    categoryId: sr.category.id,
    subcategoryId: sr.subcategory?.id ?? "",
    otherDescription: sr.other_description ?? "",
    requestedAmount: String(sr.requested_amount),
  }
}

function isSameValue(a: SpendBreakdownValue, b: SpendBreakdownValue): boolean {
  return (
    a.categoryId === b.categoryId &&
    a.subcategoryId === b.subcategoryId &&
    a.otherDescription === b.otherDescription &&
    a.requestedAmount === b.requestedAmount
  )
}

interface Props {
  spendRequest: SpendRequest
  initiativeId: string
  categories: Category[] | undefined
  categoriesLoading?: boolean
}

/** One existing draft/changes_requested spend request, editable in place —
 * pre-filled from its current values, saved only when actually changed.
 * Financial edits on anything past these two statuses are locked server-side
 * (spend_request_service.update, EDITABLE_STATUSES) — this component is only
 * ever rendered for a row already confirmed editable by the caller. */
export function EditableSpendRequestRow({ spendRequest, initiativeId, categories, categoriesLoading }: Props) {
  const original = toValue(spendRequest)
  const [value, setValue] = useState<SpendBreakdownValue>(original)
  const [error, setError] = useState<string | null>(null)
  const updateSpendRequest = useUpdateSpendRequest(spendRequest.id, initiativeId)

  const dirty = !isSameValue(value, original)

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

  return (
    <div className="border border-border bg-card p-3">
      {spendRequest.status === "changes_requested" && spendRequest.latest_decision_comment && (
        <p className="mb-2 text-xs text-chip-warning-fg">
          Changes requested: "{spendRequest.latest_decision_comment}"
        </p>
      )}
      <Table>
        <TableBody>
          <SpendBreakdownFields
            value={value}
            onChange={setValue}
            categories={categories}
            categoriesLoading={categoriesLoading}
          />
        </TableBody>
      </Table>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || updateSpendRequest.isPending}>
          {updateSpendRequest.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
