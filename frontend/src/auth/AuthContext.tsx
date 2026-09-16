import { createContext, useContext, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getDevUserEmail, setDevUserEmail } from "@/api/client"
import { useCurrentUser } from "@/api/queries"
import type { UserRead } from "@/types/domain"

interface AuthContextValue {
  user: UserRead | undefined
  isLoading: boolean
  isError: boolean
  signIn: (email: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, forceRerender] = useState(0)
  const qc = useQueryClient()
  const { data: user, isLoading, isError } = useCurrentUser()

  const signIn = (email: string) => {
    setDevUserEmail(email)
    qc.invalidateQueries()
    forceRerender((n) => n + 1)
  }

  const signOut = () => {
    setDevUserEmail(null)
    qc.clear()
    forceRerender((n) => n + 1)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isError, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function hasDevUserSelected(): boolean {
  return !!getDevUserEmail()
}
