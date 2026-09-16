export type Currency = "INR" | "USD"

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
}

const formatters: Partial<Record<Currency, Intl.NumberFormat>> = {}

function formatterFor(currency: Currency): Intl.NumberFormat {
  if (!formatters[currency]) {
    formatters[currency] = new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })
  }
  return formatters[currency]!
}

/** Formats a decimal-string amount (as returned by the API) as currency, e.g.
 * "₹2,00,000" or "$2,000". Defaults to INR for existing call sites (reports,
 * dashboards) that don't yet carry a currency alongside the amount. */
export function formatMoney(amount: string | number | null | undefined, currency: Currency = "INR"): string {
  if (amount === null || amount === undefined) return "—"
  const value = typeof amount === "string" ? Number(amount) : amount
  if (Number.isNaN(value)) return "—"
  return formatterFor(currency).format(value)
}

export function currencySymbol(currency: Currency): string {
  return currency === "USD" ? "$" : "₹"
}
