export type Role = 'site_manager' | 'director' | 'assistant' | 'staff'

export type SlackStatus = 'connected' | 'off' | 'joined' | 'missing'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  role: Role
  role_display: string
  /** Job title on the production, e.g. "Executive Producer" (separate from the site role). */
  title: string
  department: number | null
  department_name: string | null
  /** Department heads can be put on a show. */
  is_department_head: boolean
  /** The department they head; null if none was chosen or it was deleted. */
  head_of_department: number | null
  head_of_department_name: string | null
  profile_picture: string | null
  lodging: string
  room_number: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  is_active_crew: boolean
  /** Account status: only sent to Site Managers (and the person themselves). */
  email_verified?: boolean
  date_joined?: string
  last_login?: string | null
  /** Only on the signed-in user's own profile: roles they may give others. */
  assignable_roles?: Role[]
  /** Site Managers (and the person themselves): whether task messages reach them on Slack. */
  slack_status?: SlackStatus
  /** Only on the signed-in user's own profile: whether they've said they joined Slack. */
  slack_joined?: boolean
  /** Only on the signed-in user's own profile: Slack messages for new tasks. */
  slack_notifications?: boolean
  /** Only on the signed-in user's own profile: whether the server has Slack set up. */
  slack_available?: boolean
  /** Only on the signed-in user's own profile: a new email waiting for its confirmation link. */
  pending_email?: string
  /** Only on the signed-in user's own profile: when they may change their email again, if not yet. */
  next_email_change?: string | null
  /** Only on the signed-in user's own profile: link to join the K-Net Slack workspace. */
  slack_invite_url?: string
  /** Only right after creating an account without choosing a password. */
  temporary_password?: string
}

export const ROLE_LABELS: Record<Role, string> = {
  site_manager: 'Site Manager',
  director: 'Director',
  assistant: 'Assistant',
  staff: 'Staff',
}

/** Directors, Assistants, and Site Managers (who hold all permissions). */
export const MANAGER_ROLES: Role[] = ['site_manager', 'director', 'assistant']

/** Directors and Site Managers (not Assistants): they create and edit shows. */
export const DIRECTOR_ROLES: Role[] = ['site_manager', 'director']

export const isDirectorLevel = (user: User | null) => !!user && DIRECTOR_ROLES.includes(user.role)

export const isManagerLevel = (user: User | null) => !!user && MANAGER_ROLES.includes(user.role)

/** Who may open a page: `roles` (omitted means everyone signed in), plus anyone in
 *  one of `departments` (matched by name, ignoring case) whatever their role. */
export interface Access {
  roles?: Role[]
  departments?: string[]
}

export const canAccess = (user: User | null, { roles, departments }: Access) => {
  if (!user) return false
  if (!roles || roles.includes(user.role)) return true
  const department = user.department_name?.trim().toLowerCase()
  return !!department && !!departments?.some((name) => name.toLowerCase() === department)
}

/** The Marketing page: Site Managers, Directors, Assistants and the Marketing department. */
export const MARKETING_ACCESS: Access = { roles: MANAGER_ROLES, departments: ['Marketing'] }

export const isSiteManager = (user: User | null) => user?.role === 'site_manager'

/** Whether `viewer` can edit or remove `target` (mirrors the server's rules). */
export const canManageUser = (viewer: User | null, target: User) =>
  !!viewer && viewer.id !== target.id && !!viewer.assignable_roles?.includes(target.role)
