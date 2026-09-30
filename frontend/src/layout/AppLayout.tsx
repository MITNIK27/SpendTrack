import { useEffect, useRef, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { Topbar } from "@/components/Topbar"
import { AppFooter } from "@/components/AppFooter"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/auth/AuthContext"
import { cn } from "@/lib/utils"

const roleLabel: Record<string, string> = {
  member: "Team Member",
  approver: "Approver",
  admin: "Admin",
}

// Breakpoint convention for this app: `lg` (1024px) is the structural
// nav-drawer / table-card-view switch; `md` is used elsewhere for form-grid
// stacking only. Keep new responsive chrome consistent with this split.
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"

export function AppLayout() {
  const { user } = useAuth()
  const role = user?.role ?? "member"
  const [navOpen, setNavOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
    } catch {
      return false
    }
  })
  const { pathname } = useLocation()

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
    } catch {
      // Ignore — private browsing/blocked storage just means the preference
      // doesn't persist across reloads, not a functional problem.
    }
  }, [isCollapsed])
  // The page's own scroll container is this inner div (not `window` — the
  // outer grid is fixed at h-screen/overflow-hidden), so a route change has
  // to reset *its* scroll position explicitly, or a page opened partway down
  // a long list/table stays scrolled down when navigating somewhere new.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div
      className={cn(
        "grid h-screen grid-cols-1 grid-rows-[60px_1fr] overflow-hidden bg-background",
        isCollapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[248px_1fr]",
      )}
    >
      <AppSidebar
        role={role}
        className={cn("hidden lg:row-span-2 lg:flex", isCollapsed ? "w-[76px]" : "w-62")}
        collapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((v) => !v)}
      />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="p-0 lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar role={role} className="flex h-full w-full" onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <Topbar roleLabel={roleLabel[role]} onOpenNav={() => setNavOpen(true)} />
      <div ref={scrollRef} className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-y-auto lg:col-start-2">
        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
