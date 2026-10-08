import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, Clock, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SearchResultRow } from "@/components/search/SearchResultRow"
import { useGlobalSearchQuery } from "@/hooks/useGlobalSearchQuery"
import { useAuth } from "@/auth/AuthContext"
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recentSearches"

interface Props {
  onClose: () => void
}

/** Full-screen "tap search icon → takes over the screen" overlay for mobile —
 * replaces squeezing <GlobalSearch> into whatever space is left in the
 * topbar. Solid/opaque (not a partial sheet peeking at the page behind it —
 * that read as broken/overlapping rather than a deliberate overlay), with a
 * properly centered empty state so it never looks like a stray blank page.
 * Shares its fetch/debounce state and result rendering with the desktop
 * dropdown (GlobalSearch.tsx) via useGlobalSearchQuery/SearchResultRow, so
 * the two surfaces can never drift. Not built on the Radix Sheet/Dialog — a
 * full-screen panel doesn't need modal focus-trap semantics, just an Escape
 * listener and a body-scroll lock. */
export function MobileSearchOverlay({ onClose }: Props) {
  const { input, setInput, data, isFetching, hasResults } = useGlobalSearchQuery()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const go = (path: string) => {
    if (user) addRecentSearch(user.id, input)
    navigate(path)
    onClose()
  }

  const recent = user ? getRecentSearches(user.id) : []
  const showingResults = input.trim().length >= 2

  const showEmptyState = !showingResults && recent.length === 0

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-card duration-150 animate-in fade-in-0 slide-in-from-top-2">
      <div className="flex h-15 shrink-0 items-center gap-2 border-b border-border px-3 shadow-sm">
        <Button variant="ghost" size="icon" aria-label="Close search" onClick={onClose} className="shrink-0">
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search requests by name, category, amount, or requester…"
            className="h-11 rounded-full border-transparent bg-muted/60 pl-10 text-base focus-visible:bg-card"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showEmptyState && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <div className="grid size-12 place-items-center rounded-full bg-muted/60">
              <Search className="size-5" />
            </div>
            <p>Search requests by name, category, amount, or requester.</p>
          </div>
        )}

        {!showingResults && recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Recent Searches
              </span>
              <button
                type="button"
                onClick={() => user && clearRecentSearches(user.id)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="divide-y divide-border">
              {recent.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setInput(term)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-secondary/50"
                >
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showingResults && isFetching && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</p>
        )}

        {showingResults && !isFetching && !hasResults && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for "{input}".</p>
        )}

        {showingResults && !isFetching && data && data.requests.length > 0 && (
          <div>
            <div className="px-4 pt-4 pb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Requests
            </div>
            <div className="divide-y divide-border">
              {data.requests.map((r) => (
                <SearchResultRow key={r.id} result={r} onSelect={() => go(`/initiatives/${r.id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
