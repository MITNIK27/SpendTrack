// Lets api/client.ts (which can't import AuthContext without a circular
// dependency) signal "the backend just rejected our token" up to AuthContext,
// which is the only place that owns the sign-out/redirect flow.
export const SESSION_EXPIRED_EVENT = "auth:session-expired"

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
