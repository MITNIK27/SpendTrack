import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { Topbar } from "@/components/Topbar"
import { AppFooter } from "@/components/AppFooter"
import { useAuth } from "@/auth/AuthContext"

const roleLabel: Record<string, string> = {
  employee: "Team Member",
  approver: "Approver",
  admin: "Admin",
}

export function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // About is a fully dark, self-contained page with its own credits line —
  // the light shared footer would leave a cream strip under it.
  const isAbout = pathname === "/about"

  return (
    <div className="grid h-screen grid-cols-[248px_1fr] grid-rows-[60px_1fr] overflow-hidden bg-background">
      <AppSidebar role={user?.role ?? "employee"} />
      <Topbar displayName={user?.display_name ?? ""} roleLabel={roleLabel[user?.role ?? "employee"]} />
      <div className="col-start-2 row-start-2 flex min-h-0 flex-col overflow-y-auto">
        <main className={isAbout ? "flex flex-1 flex-col" : "mx-auto w-full max-w-[1320px] flex-1 p-8"}>
          <Outlet />
        </main>
        {!isAbout && <AppFooter />}
      </div>
    </div>
  )
}
