import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FolderPlus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePagination, PAGE_SIZES } from "@/components/TablePagination"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { useAuth } from "@/auth/AuthContext"
import { useDeleteInitiative, useInitiatives } from "@/api/queries"
import { ApiError } from "@/api/client"
import { formatMoney } from "@/lib/money"
import type { Initiative } from "@/types/domain"

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

  const rows = (initiatives ?? []).slice((page - 1) * pageSize, page * pageSize)

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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">{canCreate ? "My Initiatives" : "Initiatives"}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {canCreate
              ? "Group related marketing spend under an initiative, then add individual spend requests to it."
              : "Browse every initiative — open one to review and decide on its spend requests."}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/initiatives/new">+ New Initiative</Link>
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
              {canCreate ? "You haven't created any marketing initiatives yet." : "No marketing initiatives yet."}
            </h3>
            <p className="text-sm text-muted-foreground">
              An initiative is the umbrella for a conference, campaign, or activity
              {canCreate ? " — create one, then add individual spend requests under it." : "."}
            </p>
          </div>
          {canCreate && (
            <Button asChild variant="outline">
              <Link to="/initiatives/new">+ New Initiative</Link>
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && canCreate && (
        <div className="border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="divide-x divide-border">
                <TableHead className="px-4">Initiative</TableHead>
                <TableHead className="px-4">Type</TableHead>
                <TableHead className="px-4">Budget</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((initiative) => {
                const isOwner = initiative.owner.id === user?.id
                return (
                  <TableRow key={initiative.id} className="cursor-pointer divide-x divide-border odd:bg-card even:bg-muted/25">
                    <TableCell className="px-4 py-1.5">
                      <Link to={`/initiatives/${initiative.id}`} className="font-medium text-primary-text hover:underline">
                        {initiative.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-1.5">{initiative.type ?? "—"}</TableCell>
                    <TableCell className="px-4 py-1.5">{formatMoney(initiative.estimated_total_budget, initiative.currency)}</TableCell>
                    <TableCell className="px-4 py-1.5">
                      <InitiativeStatusBadge status={initiative.status} />
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
                            aria-label={`Delete ${initiative.name}`}
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
          <TablePagination
            total={initiatives?.length ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && !canCreate && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="px-5">Initiative</TableHead>
                <TableHead className="px-5">Type</TableHead>
                <TableHead className="px-5">Budget</TableHead>
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
                  <TableCell className="px-5 py-3 text-muted-foreground">{initiative.type ?? "—"}</TableCell>
                  <TableCell className="px-5 py-3 tabular-nums">
                    {formatMoney(initiative.estimated_total_budget, initiative.currency)}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <InitiativeStatusBadge status={initiative.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border px-5 py-3">
            <TablePagination
              total={initiatives?.length ?? 0}
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
            This permanently removes the initiative and any draft spend requests under it. This can't
            be undone. If any spend request under it has already been submitted, deletion isn't
            allowed — you can still edit the initiative instead.
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
