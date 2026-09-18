// In-memory only — deliberately never persisted to localStorage/sessionStorage.
// Survives a page refresh via Firebase's own (secure) session persistence: AuthContext
// re-exchanges a fresh Firebase ID token for a new app token on load, it isn't read back
// from here.
let token: string | null = null

export function getToken(): string | null {
  return token
}

export function setToken(next: string | null): void {
  token = next
}
