import { useState } from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCategories } from "@/api/queries"
import type { Currency } from "@/lib/money"

export interface InitiativeFormInitial {
  name?: string
  type?: string | null
  currency?: Currency
  estimated_total_budget?: string | null
  objective?: string | null
}

interface SecondaryAction {
  label: string
  pendingLabel: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}

interface Props {
  initial?: InitiativeFormInitial
  submitLabel: string
  pendingLabel: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  /** A second action button (e.g. "Submit for Approval" alongside a primary
   * "Save as Draft") — explicit click only, never triggered by Enter/native
   * form submit, which stays wired to the (safer) primary `onSubmit`. */
  secondaryAction?: SecondaryAction
  /** True once the request has left draft — the category/budget/currency are
   * frozen at that point (an approver may already be deciding against the
   * figures as submitted), leaving only Name and Remarks editable. */
  locked?: boolean
  /** Rendered below the form's own fields, before the submit/cancel row — lets
   * Create Initiative embed the spend section on the same page/submit. */
  children?: React.ReactNode | ((ctx: { currency: Currency }) => React.ReactNode)
}

/** The initiative name/details form — shared by Create and Edit so the two
 * screens can never drift out of sync on which fields exist. Trimmed per
 * Taru's feedback to Name / Type / Budget+Currency / Remarks — everything
 * else (date, location, audience, outcomes) now lives in one freeform
 * Remarks note instead of separate structured fields. */
export function InitiativeForm({ initial, submitLabel, pendingLabel, onSubmit, onCancel, secondaryAction, locked, children }: Props) {
  const { data: categories } = useCategories()
  const sortedTypes = [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState(initial?.type ?? "")
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "INR")
  const [estimatedTotalBudget, setEstimatedTotalBudget] = useState(initial?.estimated_total_budget ?? "")
  const [remarks, setRemarks] = useState(initial?.objective ?? "")
  const [pendingAction, setPendingAction] = useState<"primary" | "secondary" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buildPayload = (): Record<string, unknown> | null => {
    if (!name.trim()) {
      setError("Request name is required.")
      return null
    }
    if (!type) {
      setError("Please select what this request is related to.")
      return null
    }
    if (!estimatedTotalBudget) {
      setError("Total budget is required.")
      return null
    }
    const budget = Number(estimatedTotalBudget)
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Total budget must be greater than 0.")
      return null
    }
    if (!remarks.trim()) {
      setError("Remarks are required.")
      return null
    }
    // "Type" is already picked from the same A-Q spend-category taxonomy
    // (`sortedTypes` above comes straight from `useCategories()`) — carry the
    // matching category's id along too, so reporting can bucket an
    // initiative's own budget by category when it has no spend breakdown.
    const category = categories?.find((c) => c.name === type)
    return {
      name,
      type,
      category_id: category?.id ?? null,
      currency,
      objective: remarks || null,
      estimated_total_budget: budget,
    }
  }

  const run = async (action: "primary" | "secondary") => {
    setError(null)
    const payload = buildPayload()
    if (!payload) return
    setPendingAction(action)
    try {
      if (action === "primary") await onSubmit(payload)
      else await secondaryAction?.onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving the request.")
    } finally {
      setPendingAction(null)
    }
  }

  const isPending = pendingAction !== null
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run("primary")
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Request Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gartner Conference 2026" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">What is it related to? *</Label>
                <Select value={type} onValueChange={setType} disabled={locked}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="!max-h-56">
                    {sortedTypes.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={locked}>
                  <SelectTrigger id="currency" className="w-full md:w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ INR</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estimatedTotalBudget">Total Budget *</Label>
                <Input
                  id="estimatedTotalBudget"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={estimatedTotalBudget}
                  onChange={(e) => setEstimatedTotalBudget(e.target.value)}
                  disabled={locked}
                />
              </div>
            </div>

            {locked && (
              <p className="text-xs text-muted-foreground">
                What it's related to, the currency, and the total budget are locked once a request has been
                submitted — only the name and remarks can still be changed.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="remarks">Remarks *</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="What to add in Remarks" className="text-muted-foreground hover:text-foreground">
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Tell the story in your own words — what it's for, who it's meant to reach, the date and
                      place, what success looks like. A couple of honest sentences beat a perfectly filled form.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="What's this for, who's it for, expected outcomes, date, location — anything useful."
              />
            </div>
          </div>

          {typeof children === "function" ? children({ currency }) : children}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <Button type="submit" variant={secondaryAction ? "outline" : "default"} className="whitespace-nowrap" disabled={isPending}>
              {pendingAction === "primary" ? pendingLabel : submitLabel}
            </Button>
            {secondaryAction && (
              <Button type="button" className="whitespace-nowrap" onClick={() => run("secondary")} disabled={isPending}>
                {pendingAction === "secondary" ? secondaryAction.pendingLabel : secondaryAction.label}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
