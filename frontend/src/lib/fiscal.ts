// Mirrors backend/app/core/fiscal.py — keep the two in sync if this ever changes.
// InfoBeans' fiscal year is assumed April-to-March (the common Indian FY convention),
// labeled by the calendar year it ends in (Apr 2025-Mar 2026 = FY2026). Unconfirmed
// with stakeholders — change FISCAL_YEAR_START_MONTH if it's wrong.
export const FISCAL_YEAR_START_MONTH = 4

export function fiscalYearOf(d: Date): number {
  const month = d.getMonth() + 1 // JS months are 0-indexed
  return month >= FISCAL_YEAR_START_MONTH ? d.getFullYear() + 1 : d.getFullYear()
}

export function currentFiscalYear(): number {
  return fiscalYearOf(new Date())
}

export const EARLIEST_FISCAL_YEAR = 2026

/** Selectable fiscal years, most recent first. */
export function fiscalYearOptions(): number[] {
  const years: number[] = []
  for (let y = currentFiscalYear(); y >= EARLIEST_FISCAL_YEAR; y--) years.push(y)
  return years
}

/** "FY27" rather than "FY2027" — the short form used everywhere in the UI. */
export function fyLabel(year: number): string {
  return `FY${String(year).slice(-2)}`
}
