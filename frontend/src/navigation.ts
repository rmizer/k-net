import type { Role } from './auth/roles'
import { MANAGER_ROLES } from './auth/roles'

export interface NavItem {
  label: string
  path: string
  /** Roles allowed to see this item. Omitted means every signed-in user. */
  roles?: Role[]
  /** Submenu shown under the main nav while inside this section. */
  children?: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Site Manager', path: '/site-manager', roles: ['site_manager'] },
  { label: 'Dashboard', path: '/' },
  { label: 'Directory', path: '/directory' },
  {
    label: 'Staff / Crew',
    path: '/crew',
    children: [
      { label: 'Active Crew', path: '/crew' },
      { label: 'CrewFinder', path: '/crew/finder' },
    ],
  },
  { label: 'Resources', path: '/resources' },
  { label: 'Influencers', path: '/influencers' },
  {
    label: 'Schedule',
    path: '/schedule',
    children: [
      { label: 'Schedule', path: '/schedule' },
      { label: 'My Tasks', path: '/schedule/tasks' },
      { label: 'Master Timeline', path: '/schedule/timeline' },
    ],
  },
  { label: 'Documents', path: '/documents' },
  { label: 'Locations', path: '/locations' },
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
  {
    label: 'Staff Manager',
    path: '/staff-manager',
    roles: MANAGER_ROLES,
    children: [
      { label: 'Overview', path: '/staff-manager' },
      { label: 'Scheduling', path: '/staff-manager/scheduling' },
      { label: 'Task Management', path: '/staff-manager/tasks' },
    ],
  },
]

export const canSee = (item: NavItem, role: Role | undefined) =>
  !item.roles || (!!role && item.roles.includes(role))

/** True when `pathname` is `path` or inside it ('/' only matches exactly). */
export const isInSection = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
