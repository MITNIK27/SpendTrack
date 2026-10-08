import { createContext, useContext, useState, type ReactNode } from "react"

type DisplayCurrency = "INR" | "USD"

interface CurrencyContextValue {
  currency: DisplayCurrency
  setCurrency: (currency: DisplayCurrency) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

/** App-wide display-currency preference — the Topbar's ₹/$ toggle and the
 * Dashboard's report both read/write this, so switching currency from the
 * header is reflected everywhere that shows converted amounts. Session-only
 * (resets to INR on reload), matching the Dashboard-local behavior this
 * replaces. */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>("INR")
  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export function useDisplayCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error("useDisplayCurrency must be used within a CurrencyProvider")
  return ctx
}
