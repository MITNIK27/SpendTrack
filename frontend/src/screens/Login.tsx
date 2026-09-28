import { useEffect, useState } from "react"
import { useLocation, useNavigate, type Location } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BrandLockup } from "@/components/BrandLockup"
import { AppFooter } from "@/components/AppFooter"
import { useAuth } from "@/auth/AuthContext"
import { landingPathForRole } from "@/auth/roleRouting"
import { APP_NAME } from "@/lib/app-meta"

export default function Login() {
  const { user, signIn, signInError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Set by ProtectedRoute when it bounced an unauthenticated visit here —
  // e.g. clicking "Review this initiative" in an email notification before
  // signing in. Send them there instead of their role's default landing page
  // once signed in, so the link they actually clicked is where they land.
  const from = (location.state as { from?: Location } | null)?.from

  useEffect(() => {
    if (!user) return
    const destination = from ? `${from.pathname}${from.search}` : landingPathForRole(user.role)
    navigate(destination, { replace: true })
  }, [user, navigate, from])

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signIn()
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-8 p-8">
        <BrandLockup on="light" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Sign in to {APP_NAME}</CardTitle>
            <CardDescription>Use your InfoBeans Google account to continue.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={handleSignIn} disabled={isSigningIn} className="w-full">
              {isSigningIn ? "Signing in…" : "Sign in with Google"}
            </Button>
            {signInError && <p className="text-sm text-destructive">{signInError}</p>}
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  )
}
