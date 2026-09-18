import { Link, NavLink } from "react-router-dom"
import { LayoutDashboard, ClipboardCheck, ShieldCheck, FolderKanban, Users } from "lucide-react"
import { BrandLockup } from "@/components/BrandLockup"
import { landingPathForRole } from "@/auth/roleRouting"
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

export function AppSidebar({ role = "member" }: { role?: "member" | "approver" | "admin" }) {
  const groups = useNavGroups(role)

  return (
    <aside className="row-span-2 w-62 bg-gradient-to-b from-sidebar to-sidebar-accent text-sidebar-foreground flex flex-col">
      <Link
        to={landingPathForRole(role)}
        aria-label="Go to your home page"
        className="group relative flex items-center overflow-hidden border-b border-white/10 px-4 py-4"
      >
        {/* Same smoldering charcoal-to-black + crimson-glow treatment as the
            About page hero, scaled down — one consistent brand effect. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-black" />
        <div className="pointer-events-none absolute -top-10 -left-6 size-32 rounded-full bg-primary/25 blur-[60px]" />
        <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/6" />
        <div className="relative">
          <BrandLockup on="dark" />
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title || g.items[0]?.to} className="mb-6">
            {g.title && (
              <h4 className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white/45">
                {g.title}
              </h4>
            )}
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-base text-white/80 transition-colors duration-200",
                  "hover:bg-white/6 hover:text-white",
                  isActive && "bg-primary/25 text-white font-semibold",
                )}
              >
                <it.icon className="size-4 opacity-85" />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
