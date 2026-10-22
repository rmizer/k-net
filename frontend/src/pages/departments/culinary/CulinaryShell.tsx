import type { ReactNode } from 'react'
import { canEditDepartmentPage, canSeeDepartmentPage } from '../../../auth/roles'
import { useAuth } from '../../../auth/useAuth'
import { useFetch } from '../../../hooks/useFetch'
import type { ProductionSettings } from '../../../types'
import { ForbiddenPage } from '../../ForbiddenPage'
import { CulinaryNav } from './CulinaryNav'
import { NavIcon } from '../../../components/NavIcon'
import '../departments.css'
import './culinary.css'

export interface CulinaryContext {
  /** The Culinary head(s) and Site Managers, Directors and Assistants. */
  canEdit: boolean
  today: string
}

/** Header, tools row and access check shared by the Culinary pages. */
export function CulinaryShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: (context: CulinaryContext) => ReactNode
  children: (context: CulinaryContext) => ReactNode
}) {
  const { user } = useAuth()
  const production = useFetch<ProductionSettings>('/production/')
  if (!canSeeDepartmentPage(user, 'culinary')) return <ForbiddenPage />
  if (!production.data) {
    if (production.loading) return <p className="loading">Loading…</p>
    return <p className="form__error">Couldn’t load the page.</p>
  }
  const context = { canEdit: canEditDepartmentPage(user, 'culinary'), today: production.data.today }
  return (
    <section className="department culinary">
      <div className="page-header no-print">
        <div>
          <h1>
            <NavIcon name="utensils" />
            {title}
          </h1>
          <p className="subtitle">{subtitle ?? 'Culinary'}</p>
        </div>
        {actions?.(context)}
      </div>
      <CulinaryNav />
      {children(context)}
    </section>
  )
}
