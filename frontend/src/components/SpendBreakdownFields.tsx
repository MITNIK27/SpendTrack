import { useMemo, useState } from "react"
import { Maximize2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SubcategoryCombobox } from "@/components/SubcategoryCombobox"
import { useFxRate } from "@/api/queries"
import { convert } from "@/lib/fx"
import { formatMoney, type Currency } from "@/lib/money"
import type { Category } from "@/types/domain"

export interface SpendBreakdownValue {
  categoryId: string
  subcategoryId: string
  otherDescription: string
  requestedAmount: string
  currency: Currency
}

export const emptySpendBreakdown: SpendBreakdownValue = {
  categoryId: "",
  subcategoryId: "",
  otherDescription: "",
  requestedAmount: "",
  currency: "INR",
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
    currency: value.currency,
  }
}

interface Props {
  value: SpendBreakdownValue
  onChange: (value: SpendBreakdownValue) => void
  categories: Category[] | undefined
  categoriesLoading?: boolean
  onDelete?: () => void
  /** The parent request's own currency — what this row's amount converts
   * into when its own currency differs (e.g. a USD leg within an otherwise
   * INR request). */
  initiativeCurrency: Currency
}

/** One row of the spend table: type-ahead "what are you spending on" + amount,
 * with an extra full-width row underneath for categories that require a
 * free-text description (e.g. "Other"). Meant to be rendered inside a
 * <TableBody> — shared between Create Initiative's multi-row table and the
 * standalone Add Spend page's single-row table. The caller's own `<Table>`
 * must use `table-fixed` (see callers) so these columns' widths are honored
 * regardless of content — under the default `table-layout: auto`, a long
 * Remarks value silently steals width from the Amount column no matter what
 * width class is set here. */
export function SpendBreakdownFields({ value, onChange, categories, categoriesLoading, onDelete, initiativeCurrency }: Props) {
  const category = useMemo(() => categories?.find((c) => c.id === value.categoryId), [categories, value.categoryId])
  const hasSelection = !!value.categoryId
  const [expandOpen, setExpandOpen] = useState(false)
  const [draftRemarks, setDraftRemarks] = useState(value.otherDescription)
  // React Query de-dupes this across every row rendered on the page — one
  // fetch/cache entry, not one per row.
  const { data: fx } = useFxRate()
  const needsConversion = value.currency !== initiativeCurrency
  const amountValue = Number(value.requestedAmount) || 0
  const convertedAmount = needsConversion ? convert(amountValue, value.currency, initiativeCurrency, fx) : null

  const set = (patch: Partial<SpendBreakdownValue>) => onChange({ ...value, ...patch })

  const openExpanded = () => {
    setDraftRemarks(value.otherDescription)
    setExpandOpen(true)
  }
  const saveExpanded = () => {
    set({ otherDescription: draftRemarks })
    setExpandOpen(false)
  }

  return (
    <TableRow className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 md:table-row md:gap-0 md:border-0 md:p-0">
      <TableCell className="block w-full whitespace-normal align-top md:table-cell md:w-[40%]">
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
      <TableCell className="block w-full align-top md:table-cell md:w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground md:hidden">
          Amount
        </span>
        {/* One visual control, not two boxes: the currency symbol and the amount
            share a single border, with the focus ring applied to the group. */}
        <div className="flex h-8 items-stretch rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-disabled:opacity-50">
          <Select value={value.currency} onValueChange={(v) => set({ currency: v as Currency })} disabled={!hasSelection}>
            <SelectTrigger
              className="h-full w-11 shrink-0 gap-0.5 rounded-none rounded-l-lg border-0 border-r border-input bg-transparent px-1.5 shadow-none focus-visible:ring-0 disabled:opacity-100"
              aria-label="Currency"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">₹</SelectItem>
              <SelectItem value="USD">$</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={value.requestedAmount}
            onChange={(e) => set({ requestedAmount: e.target.value })}
            disabled={!hasSelection}
            placeholder={hasSelection ? "0.00" : "—"}
            className="h-full min-w-0 flex-1 rounded-none rounded-r-lg border-0 bg-transparent px-2 text-right tabular-nums shadow-none focus-visible:ring-0 disabled:opacity-100"
            aria-label="Requested amount"
          />
        </div>
        {hasSelection && needsConversion && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {convertedAmount !== null ? `≈ ${formatMoney(String(convertedAmount), initiativeCurrency)}` : "…"}
            {fx?.isStale && " (rate may be outdated)"}
          </p>
        )}
      </TableCell>
      <TableCell className="block w-full align-top md:table-cell md:w-[34%]">
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
          className="w-full overflow-hidden text-ellipsis bg-card"
          aria-label="Remarks"
        />
      </TableCell>
      <TableCell className="flex items-center justify-end gap-1 align-top md:table-cell md:w-20">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!hasSelection}
            onClick={openExpanded}
            aria-label="Enlarge remarks"
            title="Enlarge remarks"
          >
            <Maximize2 className="size-3.5 text-muted-foreground" />
          </Button>
          {onDelete && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Remove this spend">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>

      <Dialog open={expandOpen} onOpenChange={setExpandOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Remarks</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftRemarks}
            onChange={(e) => setDraftRemarks(e.target.value)}
            rows={6}
            placeholder={
              category?.requires_freetext_description ? `What is this "${category.name}" spend for? *` : "Optional"
            }
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExpandOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveExpanded}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableRow>
  )
}
