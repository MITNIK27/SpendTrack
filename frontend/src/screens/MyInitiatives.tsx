import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowDown, ArrowUp, ArrowUpDown, FolderPlus, ListFilter, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { TablePagination, PAGE_SIZES } from "@/components/TablePagination"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilterableColumnHead } from "@/components/FilterableColumnHead"
import { SortableColumnHead } from "@/components/SortableColumnHead"
import { InitiativeStatusBadge, deriveOutcome, OUTCOME_DOT_CLASS, OUTCOME_LABELS, type InitiativeOutcome } from "@/components/InitiativeStatusBadge"
import { useAuth } from "@/auth/AuthContext"
import { useDeleteInitiative, useInitiatives } from "@/api/queries"
import { ApiError } from "@/api/client"
import { formatMoney } from "@/lib/money"
import type { Initiative } from "@/types/domain"

/** "date" is the default/reset state (latest first, matches the backend's
 * own default ordering) — clicking the Initiative column header cycles
 * date → name-asc → name-desc → date, same 3-state convention as a
 * Notion/Airtable column sort toggle. */
type SortBy = "date" | "name-asc" | "name-desc"

const NEXT_SORT: Record<SortBy, SortBy> = { date: "name-asc", "name-asc": "name-desc", "name-desc": "date" }

const OUTCOME_OPTIONS: InitiativeOutcome[] = ["draft", "active", "partial", "approved", "rejected"]

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
  const canCreate = user?.role === "member"
  const { data: initiatives, isLoading, isError } = useInitiatives()
  const deleteInitiative = useDeleteInitiative()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const [pendingDelete, setPendingDelete] = useState<Initiative | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>("date")
  const [statusFilter, setStatusFilter] = useState<InitiativeOutcome | "all">("all")

  const filteredSorted = (initiatives ?? [])
    .filter((i) => statusFilter === "all" || deriveOutcome(i) === statusFilter)
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
          <p className="mt-1 text-base text-muted-foreground">
            {canCreate
              ? "Group related marketing spend under a request, then add individual spend requests to it."
              : "Browse every request — open one to review and decide on its spend requests."}
          </p>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {/* Desktop filters by clicking the Status column header itself
             (below) — this mobile-only trigger covers the card view, which
             has no column headers to click. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card text-muted-foreground lg:hidden">
                <ListFilter className="size-3.5" />
                {statusFilter === "all" ? "Status" : OUTCOME_LABELS[statusFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => changeStatusFilter(v as InitiativeOutcome | "all")}>
                {filterTabOptions.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value} className="justify-between gap-6 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className={`size-1.5 shrink-0 rounded-full ${o.dotClassName ?? "bg-muted-foreground"}`} />
                      {o.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{o.count}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Desktop sorts by clicking the Initiative column header itself
             (below) — this mobile-only button covers the card view. */}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 bg-card text-muted-foreground lg:hidden"
            onClick={cycleSortBy}
          >
            {nameSortDirection === "asc" && <ArrowUp className="size-3.5" />}
            {nameSortDirection === "desc" && <ArrowDown className="size-3.5" />}
            {!nameSortDirection && <ArrowUpDown className="size-3.5" />}
            {sortBy === "date" ? "Latest date" : sortBy === "name-asc" ? "Name (A–Z)" : "Name (Z–A)"}
          </Button>
        </div>
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
                <FilterableColumnHead
                  label="Status"
                  value={statusFilter}
                  onChange={changeStatusFilter}
                  options={filterTabOptions}
                  className="px-4"
                />
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
                <FilterableColumnHead
                  label="Status"
                  value={statusFilter}
                  onChange={changeStatusFilter}
                  options={filterTabOptions}
                  className="px-5"
                />
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
