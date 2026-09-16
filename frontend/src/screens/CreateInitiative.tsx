import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/BackButton"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InitiativeForm } from "@/components/InitiativeForm"
import {
  SpendBreakdownFields,
  buildSpendRequestPayload,
  emptySpendBreakdown,
  isSpendBreakdownEmpty,
  validateSpendBreakdown,
  type SpendBreakdownValue,
} from "@/components/SpendBreakdownFields"
import { api } from "@/api/client"
import { useCategories, useCreateInitiative } from "@/api/queries"
import { currencySymbol, formatMoney } from "@/lib/money"
import type { SpendRequest } from "@/types/domain"

export default function CreateInitiative() {
  const navigate = useNavigate()
  const createInitiative = useCreateInitiative()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const [spends, setSpends] = useState<SpendBreakdownValue[]>([emptySpendBreakdown])

  const updateSpend = (index: number, value: SpendBreakdownValue) =>
    setSpends((rows) => rows.map((row, i) => (i === index ? value : row)))
  const addSpend = () => setSpends((rows) => [...rows, emptySpendBreakdown])
  const removeSpend = (index: number) => setSpends((rows) => rows.filter((_, i) => i !== index))

  const total = spends.reduce((sum, s) => sum + (Number(s.requestedAmount) || 0), 0)

  /** Validates the entered spend rows, creates the initiative, then creates
   * each provided row under it as a draft — shared by both "Save as Draft"
   * and "Submit for Approval" (the latter submits everything afterward). */
  const createInitiativeAndSpend = async (payload: Record<string, unknown>) => {
    const provided = spends.filter((s) => !isSpendBreakdownEmpty(s))
    for (const s of provided) {
      const category = categories?.find((c) => c.id === s.categoryId)
      const err = validateSpendBreakdown(s, category)
      if (err) throw new Error(err)
    }

    const initiative = await createInitiative.mutateAsync(payload)
    const spendRequestIds: string[] = []
    for (const s of provided) {
      const created = await api.post<SpendRequest>(
        `/initiatives/${initiative.id}/spend-requests`,
        buildSpendRequestPayload(s),
      )
      spendRequestIds.push(created.id)
    }
    return { initiative, spendRequestIds }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4">
        <BackButton to="/" label="My Initiatives" />
        <h1 className="text-3xl font-bold">New Marketing Initiative</h1>
      </div>

      <InitiativeForm
        submitLabel="Save as Draft"
        pendingLabel="Saving…"
        onCancel={() => navigate(-1)}
        onSubmit={async (payload) => {
          const { initiative } = await createInitiativeAndSpend(payload)
          navigate(`/initiatives/${initiative.id}`)
        }}
        secondaryAction={{
          label: "Submit for Approval",
          pendingLabel: "Submitting…",
          onSubmit: async (payload) => {
            const { initiative, spendRequestIds } = await createInitiativeAndSpend(payload)
            await api.post(`/initiatives/${initiative.id}/submit`, { spend_request_ids: spendRequestIds })
            navigate(`/initiatives/${initiative.id}`)
          },
        }}
      >
        {({ currency }) => (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Add Spend Breakdown</h3>

            <div className="border border-border bg-card">
              <Table>
                <TableHeader>
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
                  {spends.map((spend, i) => (
                    <SpendBreakdownFields
                      key={i}
                      value={spend}
                      onChange={(value) => updateSpend(i, value)}
                      categories={categories}
                      categoriesLoading={categoriesLoading}
                      onDelete={spends.length > 1 ? () => removeSpend(i) : undefined}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button type="button" variant="outline" onClick={addSpend} className="self-start">
              + Add Spend Breakdown
            </Button>

            {total > 0 && (
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(String(total), currency)}</span>
              </div>
            )}
          </div>
        )}
      </InitiativeForm>
    </div>
  )
}
