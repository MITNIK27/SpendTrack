import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, Info, LogOut, Menu, Search, X } from "lucide-react"
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
  const name = user?.name ?? ""
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  // On mobile the hamburger and logo always stay put; there's just no room
  // for a persistent search input alongside them, so tapping the search icon
  // slots a field in between the logo and the info/account icons, rather
  // than replacing the logo or taking over the whole header.
  return (
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
        className="shrink-0 text-base font-bold leading-none tracking-tight text-foreground lg:hidden"
      >
        Spend<span className="text-primary-text">Track</span>
      </Link>

      {mobileSearchOpen && (
        <GlobalSearch
          autoFocus
          onNavigate={() => setMobileSearchOpen(false)}
          className="min-w-0 flex-1 lg:hidden"
        />
      )}

      <div className="hidden min-w-0 flex-1 lg:block">
        <GlobalSearch />
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
        <Button variant="ghost" size="icon" aria-label={`About ${APP_NAME}`} title="About" asChild>
          <Link to="/about">
            <Info className="size-4 text-muted-foreground" />
          </Link>
        </Button>
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
  )
}
