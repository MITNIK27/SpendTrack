import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { cn } from "cn"
import { Bell, ChevronRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow } from "@/components/ui/mobile-card-row"
import { SpendTrendCharts } from "@/components/SpendTrendCharts"
import { formatMoney } from "@/lib/money"
import { currentFiscalYear, fyLabel } from "@/lib/fiscal"
import { useAlerts, useInitiatives, useNewSubmissionCount, usePendingItemCount, useSpendSummary } from "@/api/queries"
import { useDisplayCurrency } from "@/context/CurrencyContext"
import type { SpendSummaryFilters } from "@/types/domain"

export default function Dashboard() {
  const navigate = useNavigate()
  // `data` (initiatives) only fed the now-hidden "Submitted Requests" tile —
  // kept fetching (cheap, and the commented-out tile below still refers to
  // it) but renamed so the unused-locals check doesn't flag it.
  const { data: _initiatives, isLoading: initiativesLoading } = useInitiatives()
  const { data: alerts } = useAlerts()
  const { data: newSubmissions } = useNewSubmissionCount()
  const { data: pendingItems } = usePendingItemCount()

  const { currency: displayCurrency } = useDisplayCurrency()

  // Dashboard always shows the current fiscal year — filtering by a
  // different period lives on the Requests page now, not here.
  const filters: SpendSummaryFilters = useMemo(
    () => ({ fiscal_year: currentFiscalYear(), display_currency: displayCurrency }),
    [displayCurrency],
  )

  const { data, isLoading, isError } = useSpendSummary(filters)
  const periodLabel = data?.fiscal_year != null ? fyLabel(data.fiscal_year) : "All Time"

  // Fed the now-hidden "Submitted Requests" tile (see the commented-out KPI
  // block below) — paused, not deleted, alongside that tile.
  // const kpis = useMemo(() => {
  //   const activeInitiatives = (initiatives ?? []).filter((i) => i.status === "active").length
  //   return { activeInitiatives }
  // }, [initiatives])

  return (
    <div>
      <div className="mb-6">
        {/* <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Overview</div> */}
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {initiativesLoading || isLoading ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="mb-8 border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Couldn't load the leadership report.
        </div>
      ) : (
        data && (
          <div className="mb-8">
            {/* Pre-"Requested/Approved" KPI layout — hidden, not deleted, in case
                Actual/Available figures become trustworthy again later.
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <KpiTile label="Submitted Requests" value={String(kpis.activeInitiatives)} onClick={() => navigate("/initiatives")} />
              <KpiTile
                label={`${periodLabel} Actual`}
                value={formatMoney(data.kpis.fy_spend_actual, data.display_currency)}
                onClick={() => setDrilldown({ title: `${periodLabel} Actual — matching spend requests` })}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4">
              <KpiTile
                label={`${periodLabel} Approved`}
                value={formatMoney(data.kpis.fy_spend_approved, data.display_currency)}
                onClick={() => setDrilldown({ title: `${periodLabel} Approved — matching spend requests` })}
              />
              <KpiTile
                label={`${periodLabel} Available`}
                value={formatMoney(data.kpis.fy_spend_available, data.display_currency)}
                onClick={() => setDrilldown({ title: `${periodLabel} Available — matching spend requests` })}
              />
            </div>
            */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <KpiTile
                label={`${periodLabel} Requested`}
                value={formatMoney(data.kpis.fy_spend_requested, data.display_currency)}
                onClick={() => navigate("/initiatives")}
              />
              <KpiTile
                label={`${periodLabel} Approved`}
                value={formatMoney(data.kpis.fy_spend_approved, data.display_currency)}
                onClick={() => navigate("/initiatives")}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Converted at 1 USD = ₹{data.fx_rate_usd_inr} (as of {data.fx_rate_as_of})
              {data.fx_rate_is_stale && " — rate may be outdated, couldn't reach the live FX source"}
            </p>
          </div>
        )
      )}

      {newSubmissions && newSubmissions.count > 0 ? (
        // A brand-new submission is informational, not a problem the way the
        // other alerts below are — the same navy-blue "chip-active" tint
        // used for the "Approval Pending" status badge, distinct from the
        // amber/red warning-or-critical tones below. Takes priority over the
        // general alerts banner below; once the approver actually opens
        // /approvals (marking these seen), this reverts to that banner on
        // their next visit, re-counted.
        <Link
          to="/approvals"
          className="group mb-8 flex items-center gap-3 border border-chip-active-fg/30 bg-chip-active-bg px-4 py-3 text-sm text-chip-active-fg transition-colors hover:bg-chip-active-fg/15"
        >
          <Bell className="size-4 shrink-0" />
          <span>
            <strong>{newSubmissions.count}</strong> New Request{newSubmissions.count === 1 ? "" : "s"} Submitted
          </span>
          <span className="ml-auto flex items-center gap-1 rounded-md bg-chip-active-fg px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-chip-active-fg/90">
            Review now <ChevronRight className="size-3.5" />
          </span>
        </Link>
      ) : (
        pendingItems && pendingItems.count > 0 && (() => {
          // The "critical" styling still comes from list_alerts (overspend)
          // — pendingItems.count itself is the TOTAL backlog size (every
          // pending spend-request-level item, regardless of staleness, plus
          // the other alert types), not just the subset list_alerts flags as
          // "pending too long."
          const isCritical = !!alerts?.some((a) => a.severity === "critical")
          return (
            <Link
              to="/approvals"
              className={`group mb-8 flex items-center gap-3 border px-4 py-3 text-sm transition-colors ${
                isCritical
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-chip-warning-fg bg-chip-warning-bg text-chip-warning-fg hover:bg-chip-warning-fg/20"
              }`}
            >
              <Bell className="size-4 shrink-0" />
              <span>
                <strong>{pendingItems.count}</strong> Pending Item{pendingItems.count === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-destructive/90">
                Review now <ChevronRight className="size-3.5" />
              </span>
            </Link>
          )
        })()
      )}


      {data && (
        <>
          <SpendTrendCharts filters={filters} byCategory={data.by_category} periodLabel={periodLabel} />

          <h2 className="mb-3 text-lg font-bold">Spend by Category</h2>
          {data.by_category.length === 0 ? (
            <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              No matching spend for these filters.
            </div>
          ) : (
            <div className="border border-border bg-card">
              <Table className="hidden lg:table">
                <TableHeader className="bg-muted/60">
                  <TableRow className="divide-x divide-border">
                    <TableHead>Category</TableHead>
                    <TableHead>Approved</TableHead>
                    {/* <TableHead>Actual</TableHead> */}
                    {/* <TableHead>Balance</TableHead> */}
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_category.map((row) => (
                    <TableRow
                      key={row.category_id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() => navigate("/initiatives", { state: { categoryId: row.category_id } })}
                    >
                      <TableCell>{row.category_name}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.approved, data.display_currency)}</TableCell>
                      {/* <TableCell className="tabular-nums">{formatMoney(row.actual, data.display_currency)}</TableCell> */}
                      {/* <TableCell className="tabular-nums">{formatMoney(row.balance, data.display_currency)}</TableCell> */}
                      <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="lg:hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <span>Category</span>
                  <span>Approved</span>
                </div>
                <div className="flex flex-col gap-3 p-3">
                {data.by_category.map((row) => (
                  <MobileRow
                    key={row.category_id}
                    onClick={() => navigate("/initiatives", { state: { categoryId: row.category_id } })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.category_name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="tabular-nums">{formatMoney(row.approved, data.display_currency)}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </span>
                    </div>
                  </MobileRow>
                ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiTile({
  label,
  value,
  onClick,
  highlight,
  className,
}: {
  label: string
  value: string
  onClick: () => void
  highlight?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border p-3 text-left transition-colors sm:p-4",
        highlight ? "border-chip-warning-fg bg-chip-warning-bg hover:bg-chip-warning-bg/80" : "border-border bg-card hover:bg-secondary/40",
        className,
      )}
    >
      <div className={`text-xs font-medium uppercase tracking-[0.12em] ${highlight ? "text-chip-warning-fg" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${highlight ? "text-chip-warning-fg" : "text-foreground"}`}>
        {value}
      </div>
      <div className={`mt-1 text-xs ${highlight ? "text-chip-warning-fg" : "text-primary-text"}`}>Click to review →</div>
    </button>
  )
}
