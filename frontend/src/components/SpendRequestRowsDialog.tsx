import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePagination, PAGE_SIZES } from "@/components/TablePagination"
import { StatusBadge } from "@/components/StatusBadge"
import { formatMoney } from "@/lib/money"
import { useSpendRequestRows } from "@/api/queries"
import type { SpendSummaryFilters } from "@/types/domain"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  filters: SpendSummaryFilters
}

/** The drill-down behind a KPI tile or category row — not just the aggregate
 * number, but exactly which spend requests make it up, who decided them, for
 * how much, and their comment. */
export function SpendRequestRowsDialog({ open, onOpenChange, title, filters }: Props) {
  const { data: rows, isLoading } = useSpendRequestRows(filters, open)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])

  // A fresh drill-down (new tile/row clicked) should always start on page 1.
  useEffect(() => {
    if (open) setPage(1)
  }, [open, filters])

  const pageRows = (rows ?? []).slice((page - 1) * pageSize, page * pageSize)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped to the viewport with its own scroll region — otherwise a dialog
          taller than the screen (header + table + pagination bar) overflows the
          fixed-position content with no way to scroll to the rest, and the
          pagination controls end up clipped off-screen. */}
      <DialogContent className="flex h-[85vh] w-[95vw] max-w-none flex-col overflow-hidden sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="px-1 py-6 text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && rows && rows.length === 0 && (
          <p className="px-1 py-6 text-sm text-muted-foreground">No matching spend requests.</p>
        )}

        {!isLoading && rows && rows.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col border border-border">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Initiative</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Decided By</TableHead>
                    <TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-64 min-w-40 whitespace-normal break-words">
                        <Link to={`/spend-requests/${row.id}`} className="font-medium text-primary-text hover:underline">
                          {row.description}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-48 min-w-32 whitespace-normal break-words">
                        <Link to={`/initiatives/${row.initiative_id}`} className="hover:underline">
                          {row.initiative_name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">{row.requester_name}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.requested_amount)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.approved_amount)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(row.actual_amount)}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell className="whitespace-normal break-words">{row.decided_by ?? "—"}</TableCell>
                      <TableCell className="max-w-64 min-w-40 whitespace-normal break-words" title={row.decision_comment ?? undefined}>
                        {row.decision_comment ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="shrink-0">
              <TablePagination
                total={rows.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
