import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/auth/AuthContext"
import { hasDevUserSelected } from "@/auth/AuthContext"
import { landingPathForRole } from "@/auth/roleRouting"

export function ProtectedRoute() {
  const { isLoading, isError, user } = useAuth()

  if (!hasDevUserSelected()) return <Navigate to="/login" replace />
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (isError || !user) return <Navigate to="/login" replace />

  return <Outlet />
}

/** Creating/owning initiatives stays a Team Member action — Approver/Admin are view-only. */
export function MemberRoute() {
  const { user } = useAuth()
  if (user && user.role !== "member") return <Navigate to={landingPathForRole(user.role)} replace />
  return <Outlet />
}

export function ApproverRoute() {
  const { user } = useAuth()
  if (user && user.role !== "approver" && user.role !== "admin") {
    return <Navigate to={landingPathForRole(user.role)} replace />
  }
  return <Outlet />
}

export function AdminRoute() {
  const { user } = useAuth()
  if (user && user.role !== "admin") return <Navigate to={landingPathForRole(user.role)} replace />
  return <Outlet />
}
