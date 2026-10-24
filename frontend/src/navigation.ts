import { canAccess, DEPARTMENT_PAGES, MANAGER_ROLES, type DepartmentPageSlug, type Role, type User } from './auth/roles'
import type { NavIconName } from './components/NavIcon'

/** Each department page's icon: in the Departments menu and on its page heading. */
export const DEPARTMENT_ICONS: Record<DepartmentPageSlug, NavIconName> = {
  production: 'clapper',
  operations: 'briefcase',
  finance: 'dollar',
  marketing: 'megaphone',
  transportation: 'bus',
  culinary: 'utensils',
  tech: 'monitor',
  'film-audio': 'video',
  security: 'guard',
}

export interface NavItem {
  label: string
  path: string
  /** Icon shown beside the label in the main nav. */
  icon?: NavIconName
  /** Roles allowed to see this item. Omitted means every signed-in user. */
  roles?: Role[]
  /** Also shown to anyone in these departments (by name, any case), whatever their role. */
  departments?: string[]
  /** A department page: shown by the department page rules instead. */
  departmentPage?: string
  /** Shown only when at least one of its children is. */
  ifAnyChild?: boolean
  /** Submenu shown under the main nav while inside this section. */
  children?: NavItem[]
  /** The main nav entry opens its children as a dropdown (hover on desktop, tap on mobile) instead of linking to `path`. */
  dropdown?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Site Manager', path: '/site-manager', icon: 'shield', roles: ['site_manager'] },
  { label: 'Staff Hub', path: '/', icon: 'home' },
  {
    label: 'Schedule',
    path: '/schedule',
    icon: 'calendar',
    children: [
      { label: 'Master Schedule', path: '/schedule' },
      { label: 'My Tasks', path: '/schedule/tasks' },
      { label: 'Master Timeline', path: '/schedule/timeline' },
      {
        label: 'Staff / Crew',
        path: '/schedule/crew',
        children: [
          { label: 'Active Crew', path: '/schedule/crew' },
          { label: 'CrewFinder', path: '/schedule/crew/finder' },
          { label: 'Invite Crew', path: '/schedule/crew/invite' },
        ],
      },
    ],
  },
  {
    label: 'Director Dashboard',
    path: '/staff-manager',
    icon: 'clipboard',
    roles: MANAGER_ROLES,
    children: [
      { label: 'Overview', path: '/staff-manager' },
      { label: 'Departments', path: '/staff-manager/departments' },
      { label: 'Scheduling', path: '/staff-manager/scheduling' },
      { label: 'Task Management', path: '/staff-manager/tasks' },
      { label: 'Shows', path: '/staff-manager/shows' },
    ],
  },
  { label: 'Influencers', path: '/influencers', icon: 'star' },
  {
    label: 'Departments',
    path: '/departments',
    icon: 'departments',
    ifAnyChild: true,
    dropdown: true,
    children: DEPARTMENT_PAGES.map(({ slug, label }): NavItem => {
      const page = { label, path: `/departments/${slug}`, icon: DEPARTMENT_ICONS[slug], departmentPage: slug }
      if (slug === 'operations') {
        return {
          ...page,
          departmentPage: undefined,
          // Managers see the office pages even without the department page.
          ifAnyChild: true,
          children: [
            { label: 'Overview', path: page.path, departmentPage: slug },
            { label: 'Documents', path: '/documents', roles: MANAGER_ROLES },
            { label: 'Meeting Notes', path: '/meeting-notes', roles: MANAGER_ROLES },
          ],
        }
      }
      if (slug === 'finance') {
        // The money pages, then the department's people and tasks. Only the
        // Finance department and managers see any of it.
        return {
          ...page,
          path: '/finance',
          children: [
            { label: 'Overview', path: '/finance' },
            { label: 'Payroll', path: '/finance/payroll' },
            { label: 'Incoming', path: '/finance/incoming' },
            { label: 'Outgoing', path: '/finance/outgoing' },
            { label: 'Invoices', path: '/finance/invoices' },
            { label: 'Payment Options', path: '/finance/payment-options' },
            { label: 'Team', path: page.path },
          ].map((child) => ({ ...child, departmentPage: slug })),
        }
      }
      return page
    }),
  },
  // Groups: the main link opens one page, and the submenu lists the rest.
  {
    label: 'Resources',
    path: '/resources',
    icon: 'resources',
    children: [
      { label: 'Locations', path: '/locations' },
      { label: 'Directory', path: '/directory' },
      { label: 'Resources', path: '/resources' },
      { label: 'Paperwork', path: '/paperwork' },
    ],
  },
  { label: 'Contact', path: '/contact', icon: 'mail' },
  { label: 'Help', path: '/help', icon: 'help' },
]

export const canSee = (item: NavItem, user: User | null): boolean =>
  canAccess(user, item) && (!item.ifAnyChild || !!item.children?.some((child) => canSee(child, user)))

/** Where a menu entry links: its first page this user can open (Operations opens
 *  Documents for managers who can't see the department page), else its own path. */
export const linkPath = (item: NavItem, user: User | null) =>
  item.children?.find((child) => canSee(child, user))?.path ?? item.path

/** True when `pathname` is `path` or inside it ('/' only matches exactly). */
export const isInSection = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)

/** True when `pathname` is the item's page or any page in its submenu. */
export const isInItem = (pathname: string, item: NavItem): boolean =>
  isInSection(pathname, item.path) || !!item.children?.some((child) => isInItem(pathname, child))
