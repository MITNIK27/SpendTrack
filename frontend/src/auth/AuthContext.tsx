import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { onIdTokenChanged, type User as FirebaseUser } from "firebase/auth"
import { auth, firebaseSignOut, signInWithGoogle } from "@/auth/firebase"
import { getToken, setToken } from "@/auth/tokenStore"
import { api, ApiError } from "@/api/client"
import { useCurrentUser } from "@/api/queries"
import type { UserRead } from "@/types/domain"

interface AuthContextValue {
  user: UserRead | undefined
  isLoading: boolean
  isError: boolean
  /** True once the initial Firebase auth-state check has resolved (whether or not
   * there's a signed-in user) — lets routing wait instead of flashing /login while
   * Firebase is still restoring a persisted session on page load. */
  authReady: boolean
  signInError: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface GoogleExchangeResponse {
  access_token: string
  user: UserRead
}

interface PendingSignIn {
  resolve: () => void
  reject: (err: unknown) => void
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, forceRerender] = useState(0)
  const [authReady, setAuthReady] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const qc = useQueryClient()
  const { data: user, isLoading, isError } = useCurrentUser()

  // onIdTokenChanged below is the ONLY place that ever exchanges a Firebase ID
  // token for an app session — it's Firebase's own recommended single source of
  // truth for reacting to sign-in, sign-out, a restored session on page refresh,
  // and a silent token refresh alike. An interactive signIn() click doesn't
  // duplicate that exchange; it just registers this deferred pair beforehand and
  // awaits whatever the listener decides for that transition, so there's exactly
  // one code path performing the network round trip, not two racing each other.
  const pendingSignIn = useRef<PendingSignIn | null>(null)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken()
          const res = await api.post<GoogleExchangeResponse>("/auth/google", { id_token: idToken })
          setToken(res.access_token)
          qc.setQueryData(["me"], res.user)
          setSignInError(null)
          pendingSignIn.current?.resolve()
        } catch (err) {
          setToken(null)
          qc.clear()
          const message = err instanceof ApiError ? err.message : "Couldn't complete sign-in. Please try again."
          setSignInError(message)
          await firebaseSignOut()
          pendingSignIn.current?.reject(err)
        }
      } else {
        setToken(null)
        qc.clear()
        pendingSignIn.current?.resolve()
      }
      pendingSignIn.current = null
      setAuthReady(true)
      forceRerender((n) => n + 1)
    })
    return unsubscribe
  }, [qc])

  const signIn = async () => {
    setSignInError(null)
    const settled = new Promise<void>((resolve, reject) => {
      pendingSignIn.current = { resolve, reject }
    })
    try {
      await signInWithGoogle()
    } catch {
      pendingSignIn.current = null
      setSignInError("Google sign-in was cancelled or failed. Please try again.")
      return
    }
    try {
      await settled
    } catch {
      // signInError was already set by the listener above — nothing more to do.
    }
  }

  const signOut = async () => {
    await firebaseSignOut()
    setToken(null)
    qc.clear()
    forceRerender((n) => n + 1)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isError, authReady, signInError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function hasSession(): boolean {
  return !!getToken()
}
