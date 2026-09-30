import { Link, NavLink } from "react-router-dom"
import { LayoutDashboard, ClipboardCheck, ShieldCheck, FolderKanban, Users, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { BrandLockup } from "@/components/BrandLockup"
import { landingPathForRole } from "@/auth/roleRouting"
import { APP_VERSION } from "@/lib/app-meta"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

// Nav is grouped by ownership, not by feature list, and role-gated so each
// role only sees the pages that are actually theirs. Approver/Admin are
// view-only over initiatives — creating one stays a Team Member action, so
// they get a read-only "Initiatives" link (browse-and-approve-from-inside)
// instead of the Team Member "My Initiatives" one.
function useNavGroups(role: "member" | "approver" | "admin"): NavGroup[] {
  const myWork: NavGroup = {
    title: "",
    items: [{ to: "/", label: "My Initiatives", icon: FolderKanban, end: true }],
  }
  const overview: NavGroup = {
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/initiatives", label: "Initiatives", icon: FolderKanban },
    ],
  }
  const approvals: NavGroup = {
    title: "Approvals",
    items: [{ to: "/approvals", label: "Pending Approvals", icon: ClipboardCheck }],
  }
  const admin: NavGroup = {
    title: "Admin",
    items: [
      { to: "/admin", label: "Admin Console", icon: ShieldCheck },
      { to: "/user-management", label: "User Management", icon: Users },
    ],
  }

  if (role === "approver") return [overview, approvals]
  if (role === "admin") return [overview, approvals, admin]
  return [myWork]
}

export function AppSidebar({
  role = "member",
  onNavigate,
  className,
  collapsed = false,
  onToggleCollapse,
}: {
  role?: "member" | "approver" | "admin"
  onNavigate?: () => void
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const groups = useNavGroups(role)

  return (
    <aside className={cn("bg-gradient-to-b from-sidebar to-sidebar-accent text-sidebar-foreground flex flex-col", className)}>
      <div className="relative flex items-center gap-1 overflow-hidden border-b border-white/10 pr-1">
        {/* Same smoldering charcoal-to-black + crimson-glow treatment as the
            About page hero, scaled down — one consistent brand effect. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-black" />
        <div className="pointer-events-none absolute -top-10 -left-6 size-32 rounded-full bg-primary/25 blur-[60px]" />
        <Link
          to={landingPathForRole(role)}
          aria-label="Go to your home page"
          onClick={onNavigate}
          className={cn(
            "group relative flex min-w-0 flex-1 items-center overflow-hidden px-3 py-4",
            collapsed && "flex-none justify-center px-0",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/6" />
          {!collapsed && (
            <div className="relative min-w-0">
              <BrandLockup on="dark" variant="icon" size="md" />
            </div>
          )}
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "relative z-10 grid size-7 shrink-0 place-items-center text-white/60 transition-colors hover:text-white",
              collapsed && "mx-auto my-3",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {groups.map((g, i) => (
          <div
            key={g.title || g.items[0]?.to}
            className={cn("mb-6", i > 0 && "border-t border-white/8 pt-6")}
          >
            {g.title && !collapsed && (
              <h4 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                {g.title}
              </h4>
            )}
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) => cn(
                    "group relative flex w-full items-center gap-3 border-l-2 border-transparent py-2.5 pl-3.5 pr-4 text-[0.9rem] text-white/75 transition-all duration-200",
                    "hover:border-white/20 hover:bg-white/6 hover:text-white",
                    isActive && "border-primary bg-white/10 font-semibold text-white",
                    collapsed && "justify-center pr-0 pl-0",
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center bg-white/8 text-white/70 transition-colors duration-200",
                          "group-hover:text-white",
                          isActive && "bg-primary text-white",
                        )}
                      >
                        <it.icon className="size-4" />
                      </span>
                      {!collapsed && <span>{it.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/35">
          Version {APP_VERSION}
        </div>
      )}
    </aside>
  )
}
