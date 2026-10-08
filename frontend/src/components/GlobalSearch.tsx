import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { SearchResultRow } from "@/components/search/SearchResultRow"
import { useGlobalSearchQuery } from "@/hooks/useGlobalSearchQuery"
import { useAuth } from "@/auth/AuthContext"
import { addRecentSearch } from "@/lib/recentSearches"

interface Props {
  autoFocus?: boolean
  /** Fired right before navigating to a result — lets a caller that shows this
   * as a temporary expanded overlay (the mobile topbar) collapse itself back. */
  onNavigate?: () => void
  /** Overrides the default width classes — e.g. a compact fixed width for the
   * mobile topbar's toggled-open search, instead of the full-bar default. */
  className?: string
}

export function GlobalSearch({ autoFocus, onNavigate, className }: Props = {}) {
  const { input, setInput, data, isFetching, hasResults } = useGlobalSearchQuery()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const go = (path: string) => {
    if (user) addRecentSearch(user.id, input)
    setOpen(false)
    setInput("")
    onNavigate?.()
    navigate(path)
  }

  const showDropdown = open && input.trim().length >= 2

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className ?? "w-full sm:w-80")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search requests by name, category, amount, or requester…"
          className="pl-9"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full z-50 mt-1 max-h-96 w-full overflow-y-auto border border-border bg-card shadow-md">
          {isFetching && <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>}

          {!isFetching && !hasResults && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for "{input}".</p>
          )}

          {!isFetching && data && data.requests.length > 0 && (
            <div>
              <div className="px-4 pt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Requests
              </div>
              {data.requests.map((r) => (
                <SearchResultRow key={r.id} result={r} onSelect={() => go(`/initiatives/${r.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
