import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canAccess, type Role } from '../auth/roles'
import { ForbiddenPage } from '../pages/ForbiddenPage'

/** Sends signed-out visitors to the login page, remembering where they were headed. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="loading">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * Hides pages from roles that can't use them. This is for the UI only; the
 * API enforces the same rules on the server.
 */
export function RequireRole({
  roles,
  departments,
  children,
}: {
  roles: Role[]
  /** Also lets in anyone in these departments, whatever their role. */
  departments?: string[]
  children?: ReactNode
}) {
  const { user } = useAuth()
  if (!canAccess(user, { roles, departments })) return <ForbiddenPage />
  return children ?? <Outlet />
}
