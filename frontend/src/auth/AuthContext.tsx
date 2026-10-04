import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, ensureCsrfCookie } from '../api'
import { AuthContext } from './context'
import type { User } from './roles'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ensureCsrfCookie()
      .then(() => api<User | null>('/auth/me/'))
      .then(setUser)
      .catch((error) => {
        if (!(error instanceof ApiError)) console.error(error)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await api<User>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(signedIn)
    return signedIn
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout/', { method: 'POST' })
    setUser(null)
    // Django rotates the CSRF token on logout; fetch a fresh one for the next login.
    await ensureCsrfCookie()
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
