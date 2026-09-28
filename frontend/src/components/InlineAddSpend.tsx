import { useState } from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SpendBreakdownFields,
  buildSpendRequestPayload,
  emptySpendBreakdown,
  validateSpendBreakdown,
  type SpendBreakdownValue,
} from "@/components/SpendBreakdownFields"
import { currencySymbol, type Currency } from "@/lib/money"
import { useCategories, useCreateSpendRequest } from "@/api/queries"
import { ApiError } from "@/api/client"

interface Props {
  initiativeId: string
  currency: Currency
  onClose: () => void
}

/** The toggled-open "add a new spend request" form — category/amount/remarks
 * plus Save / Save & Add Another / Cancel. Shared by Initiative Detail and
 * Edit Initiative so both pages offer the same "add spend without leaving
 * the page" flow; each caller owns its own open/closed boolean and renders
 * this only while open (unmounting on close is what resets the form). */
export function InlineAddSpend({ initiativeId, currency, onClose }: Props) {
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const createSpendRequest = useCreateSpendRequest(initiativeId)
  const [spend, setSpend] = useState<SpendBreakdownValue>(emptySpendBreakdown)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const save = async (andAddAnother: boolean) => {
    setError(null)
    const category = categories?.find((c) => c.id === spend.categoryId)
    const err = validateSpendBreakdown(spend, category)
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    try {
      await createSpendRequest.mutateAsync(buildSpendRequestPayload(spend))
      setSpend(emptySpendBreakdown)
      if (!andAddAnother) onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this spend request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Add Spend</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="How to log a spend" className="text-muted-foreground hover:text-foreground">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Start typing a word for what you're spending on — e.g. "hotel" or "booth" — and pick
              the closest match. Then enter the amount.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="border border-border">
        <Table>
          <TableHeader className="hidden md:table-header-group">
            <TableRow>
              <TableHead>What are you spending on?</TableHead>
              <TableHead>Amount ({currencySymbol(currency)})</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <SpendBreakdownFields
              value={spend}
              onChange={setSpend}
              categories={categories}
              categoriesLoading={categoriesLoading}
            />
          </TableBody>
        </Table>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => save(false)} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={() => save(true)} disabled={submitting}>
          Save &amp; Add Another
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
