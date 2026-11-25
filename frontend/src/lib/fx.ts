import type { Currency } from "@/lib/money"

export interface FxRates {
  /** INR value of one unit of each currency (INR itself is 1). */
  rateToInr: Record<Currency, number>
  isStale: boolean
}

/** Mirrors the backend's `fx_service.convert()`: any pair converts via INR.
 * Identity if the currencies already match (works even before `fx` has
 * loaded); `null` for a real conversion attempted before rates are
 * available, so callers can show a loading state instead of a wrong number. */
export function convert(amount: number, from: Currency, to: Currency, fx: FxRates | undefined): number | null {
  if (from === to) return amount
  if (!fx) return null
  return (amount * fx.rateToInr[from]) / fx.rateToInr[to]
}
