// Mirrors backend/scripts/seed_users.py. V1 dev-auth stub only — replaced by real
// Firebase Google SSO + email/password login in Phase 12 (see docs/architecture.md).
export interface DevUser {
  email: string
  displayName: string
  role: "employee" | "approver" | "admin"
}

export const DEV_USERS: DevUser[] = [
  { email: "paarth.sahni@infobeans.com", displayName: "Paarth Sahni", role: "admin" },
  { email: "siddharth.sethi@infobeans.com", displayName: "Siddharth Sethi", role: "approver" },
  { email: "test.@infobeans.com", displayName: "Test Team Member", role: "employee" },
]
