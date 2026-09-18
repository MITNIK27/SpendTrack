import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
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
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (user) navigate(landingPathForRole(user.role), { replace: true })
  }, [user, navigate])

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
