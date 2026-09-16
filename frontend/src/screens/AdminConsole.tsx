import { useState } from "react"
import { Link } from "react-router-dom"
import { Tags, Users } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePagination, PAGE_SIZES } from "@/components/TablePagination"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { useInitiatives } from "@/api/queries"

export default function AdminConsole() {
  const { data: initiatives, isLoading, isError } = useInitiatives()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const rows = (initiatives ?? []).slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Admin</div>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Organization-wide view of marketing initiatives, plus system configuration.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <ComingSoonTile icon={Tags} title="Category Management" description="Manage the spend category taxonomy." />
        <ComingSoonTile icon={Users} title="User & Role Management" description="Assign Team Member, Approver, and Admin roles." />
      </div>

      <h2 className="mb-3 text-lg font-bold">All Initiatives</h2>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="my-2 h-10 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Couldn't load initiatives.
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) === 0 && (
        <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No marketing initiatives have been created yet.
        </div>
      )}

      {!isLoading && !isError && (initiatives?.length ?? 0) > 0 && (
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Initiative</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((initiative) => (
                <TableRow key={initiative.id}>
                  <TableCell>
                    <Link to={`/initiatives/${initiative.id}`} className="font-medium text-primary-text hover:underline">
                      {initiative.name}
                    </Link>
                  </TableCell>
                  <TableCell>{initiative.owner.display_name}</TableCell>
                  <TableCell>{initiative.type ?? "—"}</TableCell>
                  <TableCell><InitiativeStatusBadge status={initiative.status} /></TableCell>
                </TableRow>
              ))}
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
    </div>
  )
}

function ComingSoonTile({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Tags
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 border border-border bg-card p-5">
      <div className="grid size-10 shrink-0 place-items-center bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming soon</p>
      </div>
    </div>
  )
}
