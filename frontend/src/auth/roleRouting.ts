import type { UserRole } from "@/types/domain"

/** Where each role lands right after signing in — each role gets its own named home page. */
export function landingPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
    case "approver":
      return "/dashboard"
    case "employee":
    default:
      return "/"
  }
}
