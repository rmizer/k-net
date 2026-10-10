import type { Role } from './auth/roles'
import type { NavIconName } from './components/NavIcon'
import { MANAGER_ROLES } from './auth/roles'

export interface NavItem {
  label: string
  path: string
  /** Icon shown beside the label in the main nav. */
  icon?: NavIconName
  /** Roles allowed to see this item. Omitted means every signed-in user. */
  roles?: Role[]
  /** Submenu shown under the main nav while inside this section. */
  children?: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Site Manager', path: '/site-manager', icon: 'shield', roles: ['site_manager'] },
  { label: 'Staff Hub', path: '/', icon: 'home' },
  {
    label: 'Schedule',
    path: '/schedule',
    icon: 'calendar',
    children: [
      { label: 'Schedule', path: '/schedule' },
      { label: 'My Tasks', path: '/schedule/tasks' },
      { label: 'Master Timeline', path: '/schedule/timeline' },
    ],
  },
  {
    label: 'Director’s Dashboard',
    path: '/staff-manager',
    icon: 'clipboard',
    roles: MANAGER_ROLES,
    children: [
      { label: 'Overview', path: '/staff-manager' },
      { label: 'Departments', path: '/staff-manager/departments' },
      { label: 'Scheduling', path: '/staff-manager/scheduling' },
      { label: 'Task Management', path: '/staff-manager/tasks' },
    ],
  },
  {
    label: 'Staff / Crew',
    path: '/crew',
    icon: 'crew',
    children: [
      { label: 'Active Crew', path: '/crew' },
      { label: 'CrewFinder', path: '/crew/finder' },
      { label: 'Invite Crew', path: '/crew/invite' },
    ],
  },
  { label: 'Influencers', path: '/influencers', icon: 'star' },
  // Groups: the main link opens one page, and the submenu lists the rest.
  {
    label: 'Resources',
    path: '/resources',
    icon: 'resources',
    children: [
      { label: 'Locations', path: '/locations' },
      { label: 'Directory', path: '/directory' },
      { label: 'Resources', path: '/resources' },
    ],
  },
  {
    label: 'Operations',
    path: '/documents',
    icon: 'briefcase',
    children: [
      { label: 'Documents', path: '/documents' },
      {
        label: 'Finance',
        path: '/finance',
        roles: MANAGER_ROLES,
        children: [
          { label: 'Overview', path: '/finance' },
          { label: 'Payroll', path: '/finance/payroll' },
          { label: 'Incoming', path: '/finance/incoming' },
          { label: 'Outgoing', path: '/finance/outgoing' },
          { label: 'Invoices', path: '/finance/invoices' },
          { label: 'Payment Options', path: '/finance/payment-options' },
        ],
      },
    ],
  },
  { label: 'Contact', path: '/contact', icon: 'mail' },
]

export const canSee = (item: NavItem, role: Role | undefined) =>
  !item.roles || (!!role && item.roles.includes(role))

/** True when `pathname` is `path` or inside it ('/' only matches exactly). */
export const isInSection = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)

/** True when `pathname` is the item's page or any page in its submenu. */
export const isInItem = (pathname: string, item: NavItem): boolean =>
  isInSection(pathname, item.path) || !!item.children?.some((child) => isInItem(pathname, child))
