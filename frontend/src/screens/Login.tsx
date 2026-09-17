import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Logo } from "@/components/Logo"
import { AppFooter } from "@/components/AppFooter"
import { useAuth } from "@/auth/AuthContext"
import { DEV_USERS } from "@/auth/devUsers"
import { landingPathForRole } from "@/auth/roleRouting"

const roleLabel: Record<string, string> = {
  member: "Team Member",
  approver: "Approver",
  admin: "Admin",
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const pick = (email: string, role: "member" | "approver" | "admin") => {
    signIn(email)
    navigate(landingPathForRole(role), { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center gap-8 p-8">
        <Logo on="light" className="h-8" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Sign in — Marketing Spend Portal</CardTitle>
            <CardDescription>
              Real sign-in (Google SSO + email/password) lands in a later phase. For now, pick a dev
              account below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {DEV_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => pick(u.email, u.role)}
                className="flex items-center justify-between border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <div>
                  <div className="text-base font-medium text-foreground">{u.displayName}</div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {roleLabel[u.role]}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  )
}
