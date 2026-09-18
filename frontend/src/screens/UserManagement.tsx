import { useState } from "react"
import { toast } from "sonner"
import { BackButton } from "@/components/BackButton"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminUsers, useUpdateUser } from "@/api/queries"
import { useAuth } from "@/auth/AuthContext"
import { ApiError } from "@/api/client"

const ROLE_LABEL: Record<string, string> = {
  member: "Team Member",
  approver: "Approver",
  admin: "Admin",
}

export default function UserManagement() {
  const { user: me } = useAuth()
  const { data: users, isLoading, isError } = useAdminUsers()
  const updateUser = useUpdateUser()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const changeRole = (id: string, role: string) => {
    setPendingId(id)
    updateUser.mutate(
      { id, data: { role } },
      {
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't update role."),
        onSettled: () => setPendingId(null),
      }
    )
  }

  const toggleActive = (id: string, isActive: boolean) => {
    setPendingId(id)
    updateUser.mutate(
      { id, data: { is_active: !isActive } },
      {
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't update status."),
        onSettled: () => setPendingId(null),
      }
    )
  }

  return (
    <div>
      <BackButton to="/dashboard" />
      <div className="mb-6 mt-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Admin</div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Assign Team Member, Approver, and Admin roles, or deactivate an account. This is the only
          place roles change — no code or database access needed to add the next Approver.
        </p>
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
          Couldn't load users.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => {
                const isSelf = u.id === me?.id
                const busy = pendingId === u.id
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(role) => changeRole(u.id, role)}
                        disabled={isSelf || busy}
                      >
                        <SelectTrigger className="h-8 w-40" title={isSelf ? "You can't change your own role" : undefined}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className={u.is_active ? "text-foreground" : "text-muted-foreground"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || busy}
                        title={isSelf ? "You can't deactivate your own account" : undefined}
                        onClick={() => toggleActive(u.id, u.is_active)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
