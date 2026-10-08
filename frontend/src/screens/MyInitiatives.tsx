import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Download, ChevronDown, FolderPlus, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { TablePagination, PAGE_SIZES } from "@/components/TablePagination"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SortableColumnHead } from "@/components/SortableColumnHead"
import { RequesterCombobox } from "@/components/RequesterCombobox"
import { RequestsFilterSheet, ALL, ALL_TIME, QUARTERS, MONTHS } from "@/components/RequestsFilterSheet"
import { InitiativeStatusBadge, deriveOutcome, OUTCOME_DOT_CLASS, OUTCOME_LABELS, type InitiativeOutcome } from "@/components/InitiativeStatusBadge"
import { useAuth } from "@/auth/AuthContext"
import { useCategories, useDeleteInitiative, useInitiatives, spendSummaryQueryString } from "@/api/queries"
import { ApiError, downloadFile } from "@/api/client"
import { formatMoney } from "@/lib/money"
import { currentFiscalYear, fiscalYearOptions, fyLabel, fiscalYearOf, fiscalQuarterOf } from "@/lib/fiscal"
import type { Initiative, SpendSummaryFilters } from "@/types/domain"

/** "date" is the default/reset state (latest first, matches the backend's
 * own default ordering) — clicking the Initiative column header cycles
 * date → name-asc → name-desc → date, same 3-state convention as a
 * Notion/Airtable column sort toggle. */
type SortBy = "date" | "name-asc" | "name-desc"

const NEXT_SORT: Record<SortBy, SortBy> = { date: "name-asc", "name-asc": "name-desc", "name-desc": "date" }

const OUTCOME_OPTIONS: InitiativeOutcome[] = ["draft", "active", "partial", "approved", "rejected"]
const DEFAULT_FISCAL_YEAR = String(currentFiscalYear())

/** True once there's an actual breakdown whose total doesn't match the
 * original budget — the Requested cell is highlighted in that case so the
 * gap is visible without opening the initiative. */
function requestedIsOffBudget(initiative: Initiative): boolean {
  return (
    initiative.spend_request_count > 0 &&
    initiative.total_requested_amount !== null &&
    initiative.estimated_total_budget !== null &&
    Number(initiative.total_requested_amount) !== Number(initiative.estimated_total_budget)
  )
}

export default function MyInitiatives() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const canCreate = user?.role === "member"
  const { data: initiatives, isLoading, isError } = useInitiatives()
  const { data: categories } = useCategories()
  const deleteInitiative = useDeleteInitiative()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const [pendingDelete, setPendingDelete] = useState<Initiative | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>("date")
  const [statusFilter, setStatusFilter] = useState<InitiativeOutcome | "all">("all")

  // Moved here from the Dashboard, which now always shows the current fiscal
  // year — these are the only place requests get filtered by period/category/
  // requester.
  // A member's filter surface is restricted to Category/Status (see
  // isFiltered/activeFilterCount below) — Fiscal Year/Quarter/Month/Requester
  // controls aren't shown to them, so fiscalYear must default to "all time"
  // for a member or they'd be silently stuck on the current FY with no way
  // to reach their own past requests.
  const [fiscalYear, setFiscalYear] = useState(canCreate ? ALL_TIME : DEFAULT_FISCAL_YEAR)
  const [quarter, setQuarter] = useState("")
  const [month, setMonth] = useState("")
  const [categoryId, setCategoryId] = useState(
    () => (location.state as { categoryId?: string } | null)?.categoryId ?? "",
  )
  const [requesterId, setRequesterId] = useState("")
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const isAllTime = fiscalYear === ALL_TIME

  const filteredSorted = (initiatives ?? [])
    .filter((i) => statusFilter === "all" || deriveOutcome(i) === statusFilter)
    .filter((i) => isAllTime || fiscalYearOf(new Date(i.created_at)) === Number(fiscalYear))
    .filter((i) => !quarter || fiscalQuarterOf(new Date(i.created_at)) === Number(quarter))
    .filter((i) => !month || new Date(i.created_at).getMonth() + 1 === Number(month))
    .filter((i) => !categoryId || i.category_ids.includes(categoryId))
    .filter((i) => !requesterId || i.owner.id === requesterId)
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      const cmp = a.name.localeCompare(b.name)
      return sortBy === "name-asc" ? cmp : -cmp
    })
  const rows = filteredSorted.slice((page - 1) * pageSize, page * pageSize)

  // Counts always reflect the full unfiltered list, not the current filter —
  // same convention as GitHub/Linear's issue-tab counts, so switching pills
  // never makes another pill's own count look like it changed.
  const outcomeCounts = new Map<InitiativeOutcome, number>()
  for (const i of initiatives ?? []) {
    const o = deriveOutcome(i)
    outcomeCounts.set(o, (outcomeCounts.get(o) ?? 0) + 1)
  }
  const filterTabOptions = [
    { value: "all" as const, label: "All", count: (initiatives ?? []).length, dotClassName: undefined as string | undefined },
    ...OUTCOME_OPTIONS.map((o) => ({
      value: o,
      label: OUTCOME_LABELS[o],
      count: outcomeCounts.get(o) ?? 0,
      dotClassName: OUTCOME_DOT_CLASS[o],
    })),
  ]

  const changeSortBy = (v: SortBy) => { setSortBy(v); setPage(1) }
  const cycleSortBy = () => changeSortBy(NEXT_SORT[sortBy])
  const nameSortDirection = sortBy === "name-asc" ? "asc" : sortBy === "name-desc" ? "desc" : null
  const changeStatusFilter = (v: InitiativeOutcome | "all") => { setStatusFilter(v); setPage(1) }

  // A member only ever sees their own requests (filtering by Requester would
  // be meaningless) and doesn't get the period filters either — their filter
  // surface is Category + Status only, so only those two count here.
  const isFiltered = canCreate
    ? !!categoryId || statusFilter !== "all"
    : fiscalYear !== DEFAULT_FISCAL_YEAR || !!quarter || !!month || !!categoryId || !!requesterId || statusFilter !== "all"
  const activeFilterCount = canCreate
    ? [!!categoryId, statusFilter !== "all"].filter(Boolean).length
    : [fiscalYear !== DEFAULT_FISCAL_YEAR, !!quarter, !!month, !!categoryId, !!requesterId, statusFilter !== "all"]
        .filter(Boolean).length

  const resetFilters = () => {
    setFiscalYear(canCreate ? ALL_TIME : DEFAULT_FISCAL_YEAR)
    setQuarter("")
    setMonth("")
    setCategoryId("")
    setRequesterId("")
    changeStatusFilter("all")
  }

  // Export reflects whatever's currently filtered here — reuses the same
  // report-export endpoints the Dashboard used to drive directly; status
  // isn't included since this page's Status filter is an outcome derived
  // across a request's whole breakdown, not the per-spend-request status
  // the report export endpoint filters by.
  const exportFilters: SpendSummaryFilters = useMemo(
    () => ({
      fiscal_year: !isAllTime && fiscalYear ? Number(fiscalYear) : undefined,
      all_time: isAllTime || undefined,
      quarter: quarter ? Number(quarter) : undefined,
      month: month ? Number(month) : undefined,
      category_id: categoryId || undefined,
      requester_id: requesterId || undefined,
    }),
    [isAllTime, fiscalYear, quarter, month, categoryId, requesterId],
  )
  const exportCsv = async (kind: "spend-summary" | "spend-requests") => {
    const qs = spendSummaryQueryString(exportFilters)
    try {
      await downloadFile(`/reports/${kind}/export${qs ? `?${qs}` : ""}`, `${kind}.csv`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't export this report.")
    }
  }

  const closeDeleteDialog = () => {
    setPendingDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await deleteInitiative.mutateAsync(pendingDelete.id)
      closeDeleteDialog()
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Couldn't delete this initiative. Please try again."
      )
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{canCreate ? "My Requests" : "Requests"}</h1>
          {canCreate && (
            <p className="mt-1 text-base text-muted-foreground">
              Group related marketing spend under a request, then add individual spend requests to it.
            </p>
          )}
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/initiatives/new">+ New Request</Link>
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="my-2 h-10 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Couldn't load your initiatives. Check that the backend is running and try again.
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-3 border border-border bg-card px-6 py-16 text-center">
          <div className="grid size-12 place-items-center bg-secondary">
            <FolderPlus className="size-6 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {canCreate ? "You haven't created any requests yet." : "No requests yet."}
            </h3>
            <p className="text-sm text-muted-foreground">
              A request is the umbrella for a conference, campaign, or activity
              {canCreate ? " — create one, then add individual spend requests under it." : "."}
            </p>
          </div>
          {canCreate && (
            <Button asChild variant="outline">
              <Link to="/initiatives/new">+ New Request</Link>
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && (
        <>
          {/* Mobile: one "Filter & Sort" trigger (opens a bottom sheet with
             everything) plus Export — desktop filters/sorts via the inline
             bar below and the column headers themselves. */}
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <RequestsFilterSheet
              open={filterSheetOpen}
              onOpenChange={setFilterSheetOpen}
              fiscalYear={fiscalYear}
              onFiscalYearChange={setFiscalYear}
              quarter={quarter}
              onQuarterChange={setQuarter}
              month={month}
              onMonthChange={setMonth}
              categoryId={categoryId}
              onCategoryIdChange={setCategoryId}
              categories={categories}
              requesterId={requesterId}
              onRequesterIdChange={setRequesterId}
              statusFilter={statusFilter}
              onStatusFilterChange={changeStatusFilter}
              statusOptions={filterTabOptions}
              sortBy={sortBy}
              onSortByChange={changeSortBy}
              onClear={resetFilters}
              activeCount={activeFilterCount}
              restrictedToBasicFilters={canCreate}
            />
            {isFiltered && (
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Reset filters"
                title="Reset filters"
                className="h-8 shrink-0 bg-card text-muted-foreground"
                onClick={resetFilters}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5 bg-card text-muted-foreground">
                  <Download className="size-3.5" /> Export
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

          {/* Desktop filter bar — moved here from the Dashboard, which now
             always shows the current fiscal year only. */}
          <div className="mb-3 hidden items-center gap-2 overflow-x-auto border-y border-border py-3 lg:flex">
            {!canCreate && (
              <>
                <Select value={fiscalYear} onValueChange={setFiscalYear}>
                  <SelectTrigger className="h-8 shrink-0 gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="!max-h-40" align="start">
                    <SelectItem value={ALL_TIME}>All Time</SelectItem>
                    {fiscalYearOptions().map((y) => (
                      <SelectItem key={y} value={String(y)}>{fyLabel(y)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={quarter || ALL} onValueChange={(v) => setQuarter(v === ALL ? "" : v)}>
                  <SelectTrigger className="h-8 shrink-0 gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none">
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
                  <SelectTrigger className="h-8 shrink-0 gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent className="!max-h-40" align="start">
                    <SelectItem value={ALL}>All Months</SelectItem>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Select value={categoryId || ALL} onValueChange={(v) => setCategoryId(v === ALL ? "" : v)}>
              <SelectTrigger className="h-8 shrink-0 gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="!max-h-40" align="start">
                <SelectItem value={ALL}>All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => changeStatusFilter(v as InitiativeOutcome | "all")}>
              <SelectTrigger className="h-8 shrink-0 gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium shadow-none">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="!max-h-40" align="start">
                {filterTabOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label} ({o.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!canCreate && (
              <div className="w-40 shrink-0">
                <RequesterCombobox value={requesterId} onChange={setRequesterId} />
              </div>
            )}

            {isFiltered && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={resetFilters}
                aria-label="Clear filters"
                title="Clear filters"
                className="h-8 w-8 shrink-0 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-8 shrink-0 text-xs">
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
        </>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && canCreate && (
        <div className="border border-border bg-card">
          <Table className="hidden lg:table">
            <TableHeader className="bg-muted/60">
              <TableRow className="divide-x divide-border">
                <SortableColumnHead label="Request" direction={nameSortDirection} onClick={cycleSortBy} className="px-4" />
                <TableHead className="px-4">Category</TableHead>
                <TableHead className="px-4">Total Budget</TableHead>
                <TableHead className="px-4">Requested</TableHead>
                <TableHead className="px-4">Approved</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((initiative) => {
                const isOwner = initiative.owner.id === user?.id
                const deletable = deriveOutcome(initiative) === "draft"
                return (
                  <TableRow key={initiative.id} className="cursor-pointer divide-x divide-border odd:bg-card even:bg-muted/25">
                    <TableCell className="px-4 py-1.5">
                      <Link to={`/initiatives/${initiative.id}`} className="font-medium text-primary-text hover:underline">
                        {initiative.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-1.5">{initiative.type ?? "—"}</TableCell>
                    <TableCell className="px-4 py-1.5 tabular-nums">
                      {formatMoney(initiative.estimated_total_budget, initiative.currency)}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-1.5 tabular-nums ${requestedIsOffBudget(initiative) ? "font-medium text-chip-warning-fg" : ""}`}
                    >
                      {formatMoney(initiative.total_requested_amount, initiative.currency)}
                    </TableCell>
                    <TableCell className="px-4 py-1.5 tabular-nums">
                      {formatMoney(initiative.total_approved_amount, initiative.currency)}
                    </TableCell>
                    <TableCell className="px-4 py-1.5">
                      <InitiativeStatusBadge initiative={initiative} />
                    </TableCell>
                    <TableCell className="px-4 py-1.5 text-right">
                      {isOwner && (
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${initiative.name}`}>
                            <Link to={`/initiatives/${initiative.id}/edit`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={deletable ? `Delete ${initiative.name}` : `Can't delete ${initiative.name} — already submitted`}
                            title={deletable ? undefined : "Can't delete — already submitted"}
                            disabled={!deletable}
                            onClick={() => {
                              setDeleteError(null)
                              setPendingDelete(initiative)
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 p-3 lg:hidden">
            {rows.map((initiative) => {
              const isOwner = initiative.owner.id === user?.id
              const deletable = deriveOutcome(initiative) === "draft"
              return (
                <MobileRow key={initiative.id}>
                  <div className="flex items-baseline gap-2">
                    <Link to={`/initiatives/${initiative.id}`} className="font-medium text-primary-text hover:underline">
                      {initiative.name}
                    </Link>
                  </div>
                  <MobileField label="Category">{initiative.type ?? "—"}</MobileField>
                  <MobileField label="Total Budget">{formatMoney(initiative.estimated_total_budget, initiative.currency)}</MobileField>
                  <MobileField label="Requested">
                    <span className={requestedIsOffBudget(initiative) ? "font-medium text-chip-warning-fg" : undefined}>
                      {formatMoney(initiative.total_requested_amount, initiative.currency)}
                    </span>
                  </MobileField>
                  <MobileField label="Approved">{formatMoney(initiative.total_approved_amount, initiative.currency)}</MobileField>
                  <MobileField label="Status">
                    <InitiativeStatusBadge initiative={initiative} />
                  </MobileField>
                  {isOwner && (
                    <div className="mt-1 flex justify-end gap-1 border-t border-border pt-2">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${initiative.name}`}>
                        <Link to={`/initiatives/${initiative.id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={deletable ? `Delete ${initiative.name}` : `Can't delete ${initiative.name} — already submitted`}
                        title={deletable ? undefined : "Can't delete — already submitted"}
                        disabled={!deletable}
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDelete(initiative)
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </MobileRow>
              )
            })}
          </div>
          <TablePagination
            total={filteredSorted.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && !canCreate && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="hidden lg:table">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <SortableColumnHead label="Request" direction={nameSortDirection} onClick={cycleSortBy} className="px-5" />
                <TableHead className="px-5">Created By</TableHead>
                <TableHead className="px-5">Category</TableHead>
                <TableHead className="px-5">Total Budget</TableHead>
                <TableHead className="px-5">Requested</TableHead>
                <TableHead className="px-5">Approved</TableHead>
                <TableHead className="px-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((initiative) => (
                <TableRow
                  key={initiative.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/initiatives/${initiative.id}`)}
                >
                  <TableCell className="px-5 py-3">
                    <Link
                      to={`/initiatives/${initiative.id}`}
                      className="font-medium text-primary-text hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {initiative.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-muted-foreground">{initiative.owner.name}</TableCell>
                  <TableCell className="px-5 py-3 text-muted-foreground">{initiative.type ?? "—"}</TableCell>
                  <TableCell className="px-5 py-3 tabular-nums">
                    {formatMoney(initiative.estimated_total_budget, initiative.currency)}
                  </TableCell>
                  <TableCell
                    className={`px-5 py-3 tabular-nums ${requestedIsOffBudget(initiative) ? "font-medium text-chip-warning-fg" : ""}`}
                  >
                    {formatMoney(initiative.total_requested_amount, initiative.currency)}
                  </TableCell>
                  <TableCell className="px-5 py-3 tabular-nums">
                    {formatMoney(initiative.total_approved_amount, initiative.currency)}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <InitiativeStatusBadge initiative={initiative} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 p-3 lg:hidden">
            {rows.map((initiative) => (
              <MobileRow key={initiative.id} onClick={() => navigate(`/initiatives/${initiative.id}`)}>
                <div className="flex items-baseline gap-2">
                  <Link
                    to={`/initiatives/${initiative.id}`}
                    className="font-medium text-primary-text hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {initiative.name}
                  </Link>
                </div>
                <MobileField label="Created By">{initiative.owner.name}</MobileField>
                <MobileField label="Category">{initiative.type ?? "—"}</MobileField>
                <MobileField label="Total Budget">{formatMoney(initiative.estimated_total_budget, initiative.currency)}</MobileField>
                <MobileField label="Requested">
                  <span className={requestedIsOffBudget(initiative) ? "font-medium text-chip-warning-fg" : undefined}>
                    {formatMoney(initiative.total_requested_amount, initiative.currency)}
                  </span>
                </MobileField>
                <MobileField label="Approved">{formatMoney(initiative.total_approved_amount, initiative.currency)}</MobileField>
                <MobileField label="Status">
                  <InitiativeStatusBadge initiative={initiative} />
                </MobileField>
              </MobileRow>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3">
            <TablePagination
              total={filteredSorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{pendingDelete?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the request and any draft spend requests under it. This can't
            be undone. Only a request that's still saved as a draft can be deleted — once it's been
            submitted, you can still edit it instead.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteInitiative.isPending}>
              {deleteInitiative.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
