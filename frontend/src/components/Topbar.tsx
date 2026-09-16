import { Link } from "react-router-dom"
import { Info } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/GlobalSearch"

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Topbar({ displayName, roleLabel }: { displayName: string; roleLabel: string }) {
  return (
    <header className="col-start-2 row-start-1 flex h-15 items-center justify-between gap-3 border-b border-border bg-card px-8">
      <GlobalSearch />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="About Marketing Spend Portal" title="About" asChild>
          <Link to="/about">
            <Info className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <div className="text-right">
          <div className="text-sm font-medium text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">{roleLabel}</div>
        </div>
        <Avatar>
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
