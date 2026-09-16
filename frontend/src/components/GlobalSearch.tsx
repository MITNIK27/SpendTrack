import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/StatusBadge"
import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { formatMoney } from "@/lib/money"
import { useGlobalSearch } from "@/api/queries"

const DEBOUNCE_MS = 250

export function GlobalSearch() {
  const [input, setInput] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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
    navigate(path)
  }

  const hasResults = !!data && (data.initiatives.length > 0 || data.spend_requests.length > 0)
  const showDropdown = open && input.trim().length >= 2

  return (
    <div ref={containerRef} className="relative w-80">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search initiatives, requests, vendors…"
          className="pl-9"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full z-50 mt-1 max-h-96 w-full overflow-y-auto border border-border bg-card shadow-md">
          {isFetching && <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>}

          {!isFetching && !hasResults && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for "{input}".</p>
          )}

          {!isFetching && data && data.initiatives.length > 0 && (
            <div>
              <div className="px-4 pt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Initiatives
              </div>
              {data.initiatives.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => go(`/initiatives/${i.id}`)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary/50"
                >
                  <span className="font-medium">{i.name}</span>
                  <InitiativeStatusBadge status={i.status} />
                </button>
              ))}
            </div>
          )}

          {!isFetching && data && data.spend_requests.length > 0 && (
            <div>
              <div className="px-4 pt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Spend Requests
              </div>
              {data.spend_requests.map((sr) => (
                <button
                  key={sr.id}
                  type="button"
                  onClick={() => go(`/spend-requests/${sr.id}`)}
                  className="flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-secondary/50"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium">{sr.description}</span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(sr.requested_amount)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{sr.initiative_name}</span>
                    <span>·</span>
                    <span>{sr.category_name}</span>
                    {sr.vendor && (<><span>·</span><span>{sr.vendor}</span></>)}
                    <StatusBadge status={sr.status} />
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
