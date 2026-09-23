import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "cn"
import { TriangleAlert, Download, RotateCcw, ChevronDown } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RequesterCombobox } from "@/components/RequesterCombobox"
import { SpendRequestRowsDialog } from "@/components/SpendRequestRowsDialog"
import { SpendTrendCharts } from "@/components/SpendTrendCharts"
import { formatMoney } from "@/lib/money"
import { fiscalYearOptions, currentFiscalYear, fyLabel } from "@/lib/fiscal"
import { downloadFile, ApiError } from "@/api/client"
import { useAlerts, useCategories, useInitiatives, useSpendRequests, useSpendSummary, spendSummaryQueryString } from "@/api/queries"
import { PENDING_DECISION_STATUSES, type SpendSummaryFilters } from "@/types/domain"

const QUARTERS = [
  { value: "1", label: "Q1 (Apr–Jun)" },
  { value: "2", label: "Q2 (Jul–Sep)" },
  { value: "3", label: "Q3 (Oct–Dec)" },
  { value: "4", label: "Q4 (Jan–Mar)" },
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "spent", label: "Spent" },
  { value: "closed", label: "Closed" },
]

const ALL = "__all__"
const ALL_TIME = "__all_time__"
const DEFAULT_FISCAL_YEAR = String(currentFiscalYear())

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: initiatives, isLoading: initiativesLoading } = useInitiatives()
  const { data: spendRequests, isLoading: spendLoading } = useSpendRequests()
  const { data: alerts } = useAlerts()
  const { data: categories } = useCategories()

  const [fiscalYear, setFiscalYear] = useState(DEFAULT_FISCAL_YEAR)
  const [quarter, setQuarter] = useState("")
  const [month, setMonth] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [requesterId, setRequesterId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [drilldown, setDrilldown] = useState<{ title: string; categoryId?: string } | null>(null)

  const resetFilters = () => {
    setFiscalYear(DEFAULT_FISCAL_YEAR)
    setQuarter("")
    setMonth("")
    setCategoryId("")
    setRequesterId("")
    setStatusFilter("")
  }

  const isAllTime = fiscalYear === ALL_TIME

  const filters: SpendSummaryFilters = useMemo(
    () => ({
      fiscal_year: !isAllTime && fiscalYear ? Number(fiscalYear) : undefined,
      all_time: isAllTime || undefined,
      quarter: quarter ? Number(quarter) : undefined,
      month: month ? Number(month) : undefined,
      category_id: categoryId || undefined,
      requester_id: requesterId || undefined,
      status_filter: statusFilter || undefined,
    }),
    [isAllTime, fiscalYear, quarter, month, categoryId, requesterId, statusFilter],
  )

  const { data, isLoading, isError } = useSpendSummary(filters)
  const periodLabel = data?.fiscal_year != null ? fyLabel(data.fiscal_year) : "All Time"

  const exportCsv = async (kind: "spend-summary" | "spend-requests") => {
    const qs = spendSummaryQueryString(filters)
    try {
      await downloadFile(`/reports/${kind}/export${qs ? `?${qs}` : ""}`, `${kind}.csv`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't export this report.")
    }
  }

  const kpis = useMemo(() => {
    const activeInitiatives = (initiatives ?? []).filter((i) => i.status === "active").length
    const pending = (spendRequests ?? []).filter((sr) => PENDING_DECISION_STATUSES.includes(sr.status))
    return { activeInitiatives, pending }
  }, [initiatives, spendRequests])

  const stateLoading = initiativesLoading || spendLoading
  const isFiltered =
    fiscalYear !== DEFAULT_FISCAL_YEAR || !!quarter || !!month || !!categoryId || !!requesterId || !!statusFilter

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Overview</div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Organization-wide marketing spend — status, approvals, and the leadership report, all in one place.
        </p>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          {alerts.map((a, i) => (
            <Link
              key={i}
              to={a.entity_type === "initiative" ? `/initiatives/${a.entity_id}` : `/spend-requests/${a.entity_id}`}
              className={`flex items-center gap-3 border px-4 py-3 text-sm ${
                a.severity === "critical"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-chip-warning-fg bg-chip-warning-bg text-chip-warning-fg"
              }`}
            >
              <TriangleAlert className="size-4 shrink-0" />
              <span>{a.message}</span>
            </Link>
          ))}
        </div>
      )}

      {stateLoading ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4">
          <KpiTile label="Active Initiatives" value={String(kpis.activeInitiatives)} onClick={() => navigate("/initiatives")} />
          <KpiTile
            label="Pending Approvals"
            value={String(kpis.pending.length)}
            highlight={kpis.pending.length > 0}
            onClick={() => navigate("/approvals")}
          />
        </div>
      )}

      {isLoading && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn("h-24 w-full bg-muted motion-safe:animate-pulse", i === 3 && "col-span-2 sm:col-span-1")} />
          ))}
        </div>
      )}

      {isError && (
        <div className="mb-8 border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Couldn't load the leadership report.
        </div>
      )}

      {data && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiTile
            label={`${periodLabel} Approved`}
            value={formatMoney(data.kpis.fy_spend_approved)}
            onClick={() => setDrilldown({ title: `${periodLabel} Approved — matching spend requests` })}
          />
          <KpiTile
            label={`${periodLabel} Actual`}
            value={formatMoney(data.kpis.fy_spend_actual)}
            onClick={() => setDrilldown({ title: `${periodLabel} Actual — matching spend requests` })}
          />
          <KpiTile
            className="col-span-2 sm:col-span-1"
            label={`${periodLabel} Available`}
            value={formatMoney(data.kpis.fy_spend_available)}
            onClick={() => setDrilldown({ title: `${periodLabel} Available — matching spend requests` })}
          />
        </div>
      )}

      <div className="mb-8 flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="h-8 w-full gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="!max-h-40" align="start">
              <SelectItem value={ALL_TIME}>All Time (past approvals)</SelectItem>
              {fiscalYearOptions().map((y) => (
                <SelectItem key={y} value={String(y)}>{fyLabel(y)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={quarter || ALL} onValueChange={(v) => setQuarter(v === ALL ? "" : v)}>
            <SelectTrigger className="h-8 w-full gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none sm:w-auto">
              <SelectValue placeholder="All Quarters" />
            </SelectTrigger>
            <SelectContent className="!max-h-40" align="start">
              <SelectItem value={ALL}>All Quarters</SelectItem>
              {QUARTERS.map((q) => (
                <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={month || ALL} onValueChange={(v) => setMonth(v === ALL ? "" : v)}>
            <SelectTrigger className="h-8 w-full gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none sm:w-auto">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent className="!max-h-40" align="start">
              <SelectItem value={ALL}>All Months</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId || ALL} onValueChange={(v) => setCategoryId(v === ALL ? "" : v)}>
            <SelectTrigger className="h-8 w-full gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none sm:w-auto">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="!max-h-40" align="start">
              <SelectItem value={ALL}>All Categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code}. {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter || ALL} onValueChange={(v) => setStatusFilter(v === ALL ? "" : v)}>
            <SelectTrigger className="h-8 w-full gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none sm:w-auto">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="!max-h-40" align="start">
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="sm:w-48">
            <RequesterCombobox value={requesterId} onChange={setRequesterId} />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:contents">
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs text-muted-foreground">
              <RotateCcw className="size-3.5" /> Clear
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8 text-xs">
                <Download className="size-3.5" /> Export <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem className="text-xs" onClick={() => exportCsv("spend-summary")}>
                Category Summary (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={() => exportCsv("spend-requests")}>
                Spend Requests (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {data && (
        <>
          <SpendTrendCharts filters={filters} byCategory={data.by_category} />

          <h2 className="mb-3 text-lg font-bold">Spend by Category</h2>
          <p className="mb-3 -mt-2 text-xs text-muted-foreground">Click a row to see the individual spend requests behind it.</p>
          {data.by_category.length === 0 ? (
            <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              No matching spend for these filters.
            </div>
          ) : (
            <div className="border border-border bg-card">
              <Table className="hidden lg:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_category.map((row) => (
                    <TableRow
                      key={row.category_id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() =>
                        setDrilldown({
                          title: `${row.category_code}. ${row.category_name} — matching spend requests`,
                          categoryId: row.category_id,
                        })
                      }
                    >
                      <TableCell>{row.category_code}. {row.category_name}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.approved)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.actual)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 p-3 lg:hidden">
                {data.by_category.map((row) => (
                  <MobileRow
                    key={row.category_id}
                    onClick={() =>
                      setDrilldown({
                        title: `${row.category_code}. ${row.category_name} — matching spend requests`,
                        categoryId: row.category_id,
                      })
                    }
                  >
                    <div className="font-medium">{row.category_code}. {row.category_name}</div>
                    <MobileField label="Approved">{formatMoney(row.approved)}</MobileField>
                    <MobileField label="Actual">{formatMoney(row.actual)}</MobileField>
                    <MobileField label="Balance">{formatMoney(row.balance)}</MobileField>
                  </MobileRow>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {data.matched_spend_request_count} spend request(s) matched — drafts are never included.
          </p>
        </>
      )}

      {drilldown && (
        <SpendRequestRowsDialog
          open={!!drilldown}
          onOpenChange={(open) => { if (!open) setDrilldown(null) }}
          title={drilldown.title}
          filters={drilldown.categoryId ? { ...filters, category_id: drilldown.categoryId } : filters}
        />
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
