import { useEffect, useState } from "react"
import { useLocation, useNavigate, type Location } from "react-router-dom"
import { Activity, Lock, Receipt, Send, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLockup } from "@/components/BrandLockup"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/auth/AuthContext"
import { landingPathForRole } from "@/auth/roleRouting"
import { APP_NAME } from "@/lib/app-meta"

const HIGHLIGHTS: { icon: LucideIcon; text: string }[] = [
  { icon: Receipt, text: "Log any marketing expense, big or small" },
  { icon: Send, text: "Send a request in about a minute" },
  { icon: Activity, text: "Follow every approval, start to finish" },
]

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[18px] shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.87.92 7.52 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens, where the sign-in side stands alone. */}
      <aside className="relative hidden flex-col bg-sidebar px-12 py-12 text-white lg:flex">
        <div className="flex justify-start">
          <Logo on="dark" className="h-16" />
        </div>

        <div className="my-auto max-w-md">
          <h1 className="text-4xl leading-tight font-bold tracking-tight">
            Log every marketing spend.
            <span className="block text-white/55">Know where it stands.</span>
          </h1>

          <ul className="mt-10 flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4 text-[15px]">
                <span className="grid size-10 shrink-0 place-items-center border border-white/15 text-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* <p className="text-xs text-white/50">
          {APP_NAME} · for {COPYRIGHT_OWNER.replace(" Technologies Limited", "")} teams
        </p> */}
      </aside>

      <main className="flex flex-col bg-background px-6 py-10 sm:px-12">
        <div className="flex justify-center">
          <BrandLockup variant="icon" size="xl" />
        </div>

        <div className="mx-auto my-auto w-full max-w-[432px] py-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome</h2>
          <p className="mt-2 text-muted-foreground">
            Sign in to {APP_NAME} with your InfoBeans Google credentials.
          </p>

          <Button
            variant="outline"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="mt-8 h-12 w-full gap-3 bg-card font-semibold"
          >
            <GoogleMark />
            {isSigningIn ? "Signing in…" : "Continue with Google"}
          </Button>
          {signInError && <p className="mt-3 text-sm text-destructive">{signInError}</p>}

          <p className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            One sign-in for everyone: requesters submit, approvers decide, and every action is recorded.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground lg:hidden">
          Questions? Write to spendtrack@infobeans.com
        </p>
      </main>
    </div>
  )
}
