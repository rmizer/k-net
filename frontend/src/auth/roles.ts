export type Role = 'site_manager' | 'director' | 'assistant' | 'staff'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  role: Role
  role_display: string
  department: number | null
  department_name: string | null
  profile_picture: string | null
  lodging: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  is_active_crew: boolean
}

/** Directors, Assistants, and Site Managers (who hold all permissions). */
export const MANAGER_ROLES: Role[] = ['site_manager', 'director', 'assistant']

export const isManagerLevel = (user: User | null) => !!user && MANAGER_ROLES.includes(user.role)

export const isSiteManager = (user: User | null) => user?.role === 'site_manager'
