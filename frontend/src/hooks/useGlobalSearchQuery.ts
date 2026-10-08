import { useEffect, useState } from "react"
import { useGlobalSearch } from "@/api/queries"

const DEBOUNCE_MS = 250

/** Shared input/debounce/fetch state behind both the desktop inline dropdown
 * (GlobalSearch.tsx) and the mobile full-screen overlay (MobileSearchOverlay.tsx)
 * — kept in one place so the two surfaces can never drift in how they talk to
 * the `/search` endpoint. */
export function useGlobalSearchQuery() {
  const [input, setInput] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const { data, isFetching } = useGlobalSearch(debounced)
  const hasResults = !!data && data.requests.length > 0

  return { input, setInput, data, isFetching, hasResults }
}
