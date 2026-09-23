import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/BackButton"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SpendBreakdownFields,
  buildSpendRequestPayload,
  emptySpendBreakdown,
  validateSpendBreakdown,
  type SpendBreakdownValue,
} from "@/components/SpendBreakdownFields"
import { currencySymbol, formatMoney } from "@/lib/money"
import { api, ApiError } from "@/api/client"
import { useCategories, useCreateSpendRequest, useInitiative } from "@/api/queries"
import type { SpendRequest } from "@/types/domain"

export default function AddSpend() {
  const { id: initiativeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { data: initiative } = useInitiative(initiativeId)
  const createSpendRequest = useCreateSpendRequest(initiativeId!)
  const [spend, setSpend] = useState<SpendBreakdownValue>(emptySpendBreakdown)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const category = categories?.find((c) => c.id === spend.categoryId)
  const currency = initiative?.currency ?? "INR"

  const validate = (): string | null => validateSpendBreakdown(spend, category)

  const saveDraft = async () => {
    setError(null)
    const err = validate()
    if (err) return setError(err)
    setSubmitting(true)
    try {
      const created = await createSpendRequest.mutateAsync(buildSpendRequestPayload(spend))
      // While the initiative itself is still a draft, this spend can't be
      // submitted on its own — land back on the initiative instead of a lone
      // spend request's detail page, which wouldn't have anywhere useful to go.
      navigate(initiative?.status === "draft" ? `/initiatives/${initiative.id}` : `/spend-requests/${created.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this spend request.")
    } finally {
      setSubmitting(false)
    }
  }

  const saveAndAddAnother = async () => {
    setError(null)
    const err = validate()
    if (err) return setError(err)
    setSubmitting(true)
    try {
      const created = await createSpendRequest.mutateAsync(buildSpendRequestPayload(spend))
      toast(`"${created.description}" added as a draft.`, {
        action:
          initiative?.status === "draft"
            ? undefined
            : { label: "View it", onClick: () => navigate(`/spend-requests/${created.id}`) },
      })
      setSpend(emptySpendBreakdown)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this spend request.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitForApproval = async () => {
    setError(null)
    const err = validate()
    if (err) return setError(err)
    setSubmitting(true)
    try {
      const created = await createSpendRequest.mutateAsync(buildSpendRequestPayload(spend))
      await api.post<SpendRequest>(`/spend-requests/${created.id}/submit`)
      navigate(`/spend-requests/${created.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit this spend request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-6">
        {initiative && <BackButton to={`/initiatives/${initiative.id}`} label={initiative.name} />}
        <h1 className="text-3xl font-bold">Add Spend</h1>
      </div>

      {initiative && initiative.spend_requests.length > 0 && (
        <div className="mb-6 border border-border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Already added to this initiative ({initiative.spend_requests.length})
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {initiative.spend_requests.map((sr) => (
              <li key={sr.id} className="flex items-center justify-between">
                <Link to={`/spend-requests/${sr.id}`} className="text-primary-text hover:underline">{sr.description ?? sr.category.name}</Link>
                <span className="tabular-nums text-muted-foreground">{formatMoney(sr.requested_amount, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="border border-border">
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead>
                    <span className="flex items-center gap-1.5">
                      What are you spending on?
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
                    </span>
                  </TableHead>
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

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            {!!initiative && initiative.status !== "draft" && (
              <Button type="button" onClick={submitForApproval} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit for Approval"}
              </Button>
            )}
            <Button
              type="button"
              variant={initiative?.status === "draft" ? "default" : "outline"}
              onClick={saveDraft}
              disabled={submitting}
            >
              {submitting ? "Saving…" : initiative?.status === "draft" ? "Save" : "Save as Draft"}
            </Button>
            <Button type="button" variant="outline" onClick={saveAndAddAnother} disabled={submitting}>
              Save &amp; Add Another
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
