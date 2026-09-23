import { useMemo } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { SubcategoryCombobox } from "@/components/SubcategoryCombobox"
import type { Category } from "@/types/domain"

export interface SpendBreakdownValue {
  categoryId: string
  subcategoryId: string
  otherDescription: string
  requestedAmount: string
}

export const emptySpendBreakdown: SpendBreakdownValue = {
  categoryId: "",
  subcategoryId: "",
  otherDescription: "",
  requestedAmount: "",
}

/** Nothing entered yet — the caller can treat the whole row as skipped. */
export function isSpendBreakdownEmpty(value: SpendBreakdownValue): boolean {
  return !value.categoryId && !value.requestedAmount
}

/** Category is picked, but the request isn't submittable yet (missing amount, or a
 * required free-text description for a category that needs one). */
export function validateSpendBreakdown(value: SpendBreakdownValue, category: Category | undefined): string | null {
  if (!value.categoryId) return "Search for and select what you're spending on."
  if (category?.requires_freetext_description && !value.otherDescription.trim()) {
    return `"${category.name}" requires a description of what this spend is for.`
  }
  const amount = Number(value.requestedAmount)
  if (!value.requestedAmount || Number.isNaN(amount) || amount <= 0) {
    return "Enter a requested amount greater than zero."
  }
  return null
}

export function buildSpendRequestPayload(value: SpendBreakdownValue) {
  return {
    category_id: value.categoryId,
    subcategory_id: value.subcategoryId || null,
    other_description: value.otherDescription || null,
    vendor: null,
    requested_amount: Number(value.requestedAmount),
  }
}

interface Props {
  value: SpendBreakdownValue
  onChange: (value: SpendBreakdownValue) => void
  categories: Category[] | undefined
  categoriesLoading?: boolean
  onDelete?: () => void
}

/** One row of the spend table: type-ahead "what are you spending on" + amount,
 * with an extra full-width row underneath for categories that require a
 * free-text description (e.g. "Other"). Meant to be rendered inside a
 * <TableBody> — shared between Create Initiative's multi-row table and the
 * standalone Add Spend page's single-row table. */
export function SpendBreakdownFields({ value, onChange, categories, categoriesLoading, onDelete }: Props) {
  const category = useMemo(() => categories?.find((c) => c.id === value.categoryId), [categories, value.categoryId])
  const hasSelection = !!value.categoryId

  const set = (patch: Partial<SpendBreakdownValue>) => onChange({ ...value, ...patch })

  return (
    <TableRow className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 md:table-row md:gap-0 md:border-0 md:p-0">
      <TableCell className="block w-full whitespace-normal align-top md:table-cell md:w-1/2">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground md:hidden">
          What are you spending on?
        </span>
        <SubcategoryCombobox
          categories={categories}
          categoriesLoading={categoriesLoading}
          value={value.categoryId ? { categoryId: value.categoryId, subcategoryId: value.subcategoryId } : null}
          onChange={(sel) =>
            set(
              sel
                ? { categoryId: sel.categoryId, subcategoryId: sel.subcategoryId }
                // Clearing the selection clears anything that depended on it — an
                // amount or description left over from the previous category would
                // otherwise silently persist and get submitted as-is.
                : { categoryId: "", subcategoryId: "", requestedAmount: "", otherDescription: "" },
            )
          }
        />
      </TableCell>
      <TableCell className="block w-full align-top md:table-cell md:w-auto">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground md:hidden">
          Amount
        </span>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value.requestedAmount}
          onChange={(e) => set({ requestedAmount: e.target.value })}
          disabled={!hasSelection}
          placeholder={hasSelection ? undefined : "—"}
          className="bg-card"
          aria-label="Requested amount"
        />
      </TableCell>
      <TableCell className="block w-full align-top md:table-cell md:w-auto">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground md:hidden">
          Remarks
        </span>
        <Input
          type="text"
          value={value.otherDescription}
          onChange={(e) => set({ otherDescription: e.target.value })}
          disabled={!hasSelection}
          placeholder={
            category?.requires_freetext_description ? `What is this "${category.name}" spend for? *` : "Optional"
          }
          className="bg-card"
          aria-label="Remarks"
        />
      </TableCell>
      <TableCell className="flex justify-end align-top md:table-cell md:w-auto">
        {onDelete && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Remove this spend">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
