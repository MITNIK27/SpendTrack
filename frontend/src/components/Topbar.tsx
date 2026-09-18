import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, Info, LogOut } from "lucide-react"
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
import { APP_NAME } from "@/lib/app-meta"

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Topbar({ roleLabel }: { roleLabel: string }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const name = user?.name ?? ""

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  return (
    <header className="col-start-2 row-start-1 flex h-15 items-center justify-between gap-3 border-b border-border bg-card px-8">
      <GlobalSearch />
      <div className="flex items-center gap-3">
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
              <div className="text-right">
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
