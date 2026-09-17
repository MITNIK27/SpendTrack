import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, ClipboardCheck, ShieldCheck, FolderKanban } from "lucide-react"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/auth/AuthContext"
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
    items: [{ to: "/admin", label: "Admin Console", icon: ShieldCheck }],
  }

  if (role === "approver") return [overview, approvals]
  if (role === "admin") return [overview, approvals, admin]
  return [myWork]
}

export function AppSidebar({ role = "member" }: { role?: "member" | "approver" | "admin" }) {
  const groups = useNavGroups(role)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const switchAccount = () => {
    signOut()
    navigate("/login")
  }

  return (
    <aside className="row-span-2 w-62 bg-sidebar text-sidebar-foreground flex flex-col">
      <button
        onClick={switchAccount}
        aria-label="Switch account — sign out and return to sign-in"
        title="Switch account"
        className="flex flex-col items-start gap-0.5 px-6 py-4 text-left transition-colors hover:bg-white/6"
      >
        <Logo on="dark" className="h-8" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">Switch account</span>
      </button>
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
