const MAX_RECENT = 8

function key(userId: string): string {
  return `recent-searches:${userId}`
}

/** Device-local search history, scoped per user id (so a shared device doesn't
 * leak one account's searches into another's) — same localStorage-backed
 * pattern as SIDEBAR_COLLAPSED_KEY in layout/AppLayout.tsx. Wrapped in
 * try/catch since localStorage can throw (private browsing, blocked site
 * data, etc.) — a lost search history is never worth breaking search over. */
export function getRecentSearches(userId: string): string[] {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addRecentSearch(userId: string, term: string): void {
  const trimmed = term.trim()
  if (!trimmed) return
  try {
    const existing = getRecentSearches(userId).filter((t) => t.toLowerCase() !== trimmed.toLowerCase())
    const next = [trimmed, ...existing].slice(0, MAX_RECENT)
    localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    // Best-effort — losing history silently beats breaking search.
  }
}

export function clearRecentSearches(userId: string): void {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // Ignore — nothing to clean up if storage is unavailable.
  }
}
