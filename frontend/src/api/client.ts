import { getToken, setToken } from "@/auth/tokenStore"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8005/api"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (!res.ok) {
    // Session expired, revoked, or the account was deactivated mid-session — drop the
    // stale token so ProtectedRoute sends the user back to /login instead of retrying
    // forever with a token the backend will never accept again.
    if (res.status === 401) setToken(null)

    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // non-JSON error body — fall back to statusText
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

/** Downloads a file from an authenticated GET endpoint (e.g. a CSV export) — a plain
 * <a href> can't carry the Authorization header, so this fetches the blob and triggers
 * the browser's save dialog itself. `filename` is a fallback; the server's own
 * Content-Disposition filename (if present) wins. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!res.ok) {
    if (res.status === 401) setToken(null)

    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // non-JSON error body — fall back to statusText
    }
    throw new ApiError(res.status, detail)
  }

  const disposition = res.headers.get("Content-Disposition")
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const resolvedFilename = match?.[1] ?? filename

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = resolvedFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
