import type { Currency } from "@/lib/money"

export interface FxRate {
  rate: number
  asOf: string
  isStale: boolean
}

/** Converts `amount` between currencies using `fx`'s USD→INR rate — mirrors
 * the backend's `fx_service.convert()`. Identity if the currencies already
 * match (works even before `fx` has loaded); `null` for a real cross-currency
 * conversion attempted before the rate is available, so callers can show a
 * loading state instead of a wrong number. */
export function convert(amount: number, from: Currency, to: Currency, fx: FxRate | undefined): number | null {
  if (from === to) return amount
  if (!fx) return null
  if (from === "USD" && to === "INR") return amount * fx.rate
  if (from === "INR" && to === "USD") return amount / fx.rate
  return amount
}
