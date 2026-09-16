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
  /** Rendered below the form's own fields, before the submit/cancel row — lets
   * Create Initiative embed the spend section on the same page/submit. */
  children?: React.ReactNode | ((ctx: { currency: Currency }) => React.ReactNode)
}

/** The initiative name/details form — shared by Create and Edit so the two
 * screens can never drift out of sync on which fields exist. Trimmed per
 * Taru's feedback to Name / Type / Budget+Currency / Remarks — everything
 * else (date, location, audience, outcomes) now lives in one freeform
 * Remarks note instead of separate structured fields. */
export function InitiativeForm({ initial, submitLabel, pendingLabel, onSubmit, onCancel, secondaryAction, children }: Props) {
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
      setError("Initiative name is required.")
      return null
    }
    if (!type) {
      setError("Initiative type is required.")
      return null
    }
    if (!estimatedTotalBudget) {
      setError("Budget amount is required.")
      return null
    }
    return {
      name,
      type,
      currency,
      objective: remarks || null,
      estimated_total_budget: Number(estimatedTotalBudget),
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
      setError(err instanceof Error ? err.message : "Something went wrong saving the initiative.")
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
              <Label htmlFor="name">Initiative Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gartner Conference 2026" />
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Initiative Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent className="!max-h-56">
                    {sortedTypes.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estimatedTotalBudget">Budget Amount *</Label>
                <Input
                  id="estimatedTotalBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedTotalBudget}
                  onChange={(e) => setEstimatedTotalBudget(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger id="currency" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ INR</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="remarks">Remarks</Label>
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

          <div className="flex items-center gap-3">
            <Button type="submit" variant={secondaryAction ? "outline" : "default"} disabled={isPending}>
              {pendingAction === "primary" ? pendingLabel : submitLabel}
            </Button>
            {secondaryAction && (
              <Button type="button" onClick={() => run("secondary")} disabled={isPending}>
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
