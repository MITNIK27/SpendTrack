import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobalSearch } from "@/components/GlobalSearch"
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay"
import { BrandLockup } from "@/components/BrandLockup"
import { CurrencyToggle } from "@/components/CurrencyToggle"
import { useAuth } from "@/auth/AuthContext"
import { landingPathForRole } from "@/auth/roleRouting"
import { APP_NAME } from "@/lib/app-meta"

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Topbar({ roleLabel, onOpenNav }: { roleLabel: string; onOpenNav: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const name = user?.name ?? ""
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  // On mobile the hamburger and logo always stay put; there's just no room
  // for a persistent search input alongside them, so tapping the search icon
  // opens a dedicated full-screen overlay instead (MobileSearchOverlay),
  // rendered as a sibling of the header so it can cover the whole viewport.
  return (
    <>
    <header className="col-start-1 row-start-1 flex h-15 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-6 lg:col-start-2 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="shrink-0 lg:hidden"
        onClick={onOpenNav}
      >
        <Menu className="size-4 text-muted-foreground" />
      </Button>

      <Link
        to={landingPathForRole(user?.role ?? "member")}
        aria-label={`Go to your home page — ${APP_NAME}`}
        className="shrink-0 lg:hidden"
      >
        <BrandLockup variant="icon" />
      </Link>

      <div className="hidden min-w-0 flex-1 lg:block">
        <GlobalSearch className="w-full max-w-xl" />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileSearchOpen ? "Close search" : "Search"}
          className="lg:hidden"
          onClick={() => setMobileSearchOpen((open) => !open)}
        >
          {mobileSearchOpen ? (
            <X className="size-4 text-muted-foreground" />
          ) : (
            <Search className="size-4 text-muted-foreground" />
          )}
        </Button>
        {pathname === "/dashboard" && <CurrencyToggle />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted"
            >
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-foreground">{name}</div>
                <div className="text-xs text-muted-foreground">{roleLabel}</div>
              </div>
              <Avatar>
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    {mobileSearchOpen && <MobileSearchOverlay onClose={() => setMobileSearchOpen(false)} />}
    </>
  )
}
