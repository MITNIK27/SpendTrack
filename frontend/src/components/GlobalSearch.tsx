import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { formatMoney } from "@/lib/money"
import { useGlobalSearch } from "@/api/queries"

const DEBOUNCE_MS = 250

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
  const [input, setInput] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const { data, isFetching } = useGlobalSearch(debounced)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const go = (path: string) => {
    setOpen(false)
    setInput("")
    onNavigate?.()
    navigate(path)
  }

  const hasResults = !!data && data.requests.length > 0
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
                <button
                  key={r.id}
                  type="button"
                  onClick={() => go(`/initiatives/${r.id}`)}
                  className="flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-secondary/50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <InitiativeStatusBadge initiative={r} />
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.category_name && <span>{r.category_name}</span>}
                    {r.category_name && <span>·</span>}
                    <span className="tabular-nums">{formatMoney(r.estimated_total_budget, r.currency)}</span>
                    {r.owner_name && (<><span>·</span><span>{r.owner_name}</span></>)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
