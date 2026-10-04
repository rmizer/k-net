import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { MANAGER_ROLES, type Role } from './auth/roles'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { AccountPage } from './pages/AccountPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

const NON_MANAGER_ROLES: Role[] = ['director', 'assistant', 'staff']

// Pages not built yet, with the contents planned for each (from the site plan).
const PLACEHOLDERS: { path: string; title: string; planned: string[]; roles?: Role[] }[] = [
  {
    path: '/',
    title: 'Dashboard',
    planned: [
      'Weather',
      'Announcements (about 75% width) and Alerts (about 25% width)',
      'Daily Rundown: links to today’s calendar events',
      'Your Tasks',
      'Staff Tasks (Directors and Assistants only)',
      'Weekly schedule preview with a link to the monthly schedule',
      'Today’s Crew, grouped by department',
    ],
  },
  {
    path: '/directory',
    title: 'Directory',
    planned: [
      'Every staff member, grouped by department, shown as small tiles',
      'Name, department, role, lodging, email, phone',
      'Emergency contacts (visible to Directors and Assistants only)',
    ],
  },
  {
    path: '/crew',
    title: 'Staff / Crew',
    planned: ['Active crew and staff currently working', 'Small tiles under department headers'],
  },
  {
    path: '/crew/finder',
    title: 'CrewFinder',
    planned: ['Live crew locations from location trackers', 'Only Site Managers can add trackers'],
  },
  {
    path: '/resources',
    title: 'Resources Directory',
    planned: [
      'Vendors: caterers, rentals, transportation, equipment, utilities, technical resources, stores',
      'Company name, contact name, address, phone (editable by Directors and Assistants)',
    ],
  },
  {
    path: '/influencers',
    title: 'Influencer Roster',
    planned: [
      'Square tiles for each influencer / content creator',
      'Profile: contact details, agent info, notes, schedule and needs, travel arrangements',
      'Only Directors and Assistants can add, edit or remove influencers',
    ],
  },
  {
    path: '/schedule',
    title: 'Schedule',
    planned: [
      'Daily schedule view',
      'Calendar that switches between weekly and monthly views',
      'Recent tasks with a link to your task list',
      'Influencer events styled differently; your own entries highlighted',
      'Filter by staff member',
    ],
  },
  { path: '/schedule/tasks', title: 'My Tasks', planned: ['Tasks assigned to you'] },
  {
    path: '/schedule/timeline',
    title: 'Master Timeline',
    planned: [
      'Project-wide timeline',
      'Directors and Assistants create and edit timelines (name, start, end, description)',
    ],
  },
  {
    path: '/documents',
    title: 'Documents',
    planned: [
      'Insurance, permits, contracts, vehicle documents, invoices, vouchers, receipts, miscellaneous',
      'Everyone can upload receipts and see their own, with status: Submitted, Viewed, In Process, Processed',
      'Directors and Assistants see and manage every document type',
    ],
  },
  {
    path: '/locations',
    title: 'Locations',
    planned: ['Lodging, shooting and custom location types'],
  },
  {
    path: '/finance',
    title: 'Finance',
    roles: MANAGER_ROLES,
    planned: [
      'Vendor payments due, staff paychecks due, new receipts and their status',
      'Scheduled auto drafts',
      'Finance calendar (separate from the crew schedule)',
    ],
  },
  {
    path: '/finance/payroll',
    title: 'Payroll',
    roles: MANAGER_ROLES,
    planned: [
      'Staff pay table you can sort and filter, with a page per person',
      'Printable payroll reports that follow the active filters',
      'Receipt reimbursements added to paychecks',
    ],
  },
  {
    path: '/finance/incoming',
    title: 'Incoming',
    roles: MANAGER_ROLES,
    planned: ['Running statement of incoming money', 'Source, amount, description, deposited into, document'],
  },
  {
    path: '/finance/outgoing',
    title: 'Outgoing',
    roles: MANAGER_ROLES,
    planned: ['Outgoing payments', 'Receipts submitted for reimbursement'],
  },
  {
    path: '/finance/invoices',
    title: 'Invoices',
    roles: MANAGER_ROLES,
    planned: ['Submit and view invoices', 'Table you can sort and filter; open or archive any invoice'],
  },
  {
    path: '/finance/payment-options',
    title: 'Payment Options',
    roles: MANAGER_ROLES,
    planned: ['Company cards, bank accounts and digital payment methods', 'Asks for confirmation before deleting'],
  },
  {
    path: '/staff-manager',
    title: 'Staff Manager',
    roles: MANAGER_ROLES,
    planned: ['Your task list', 'Master staff list you can sort and filter'],
  },
  {
    path: '/staff-manager/scheduling',
    title: 'Scheduling',
    roles: MANAGER_ROLES,
    planned: ['Edit individual staff schedules'],
  },
  {
    path: '/staff-manager/tasks',
    title: 'Task Management',
    roles: MANAGER_ROLES,
    planned: ['Assign tasks to staff; they appear on that person’s dashboard'],
  },
  {
    path: '/site-manager',
    title: 'Site Manager Dashboard',
    roles: ['site_manager'],
    planned: [
      'System status and support requests',
      'Support tools only Site Managers can use',
      'Add location trackers for staff',
    ],
  },
  {
    path: '/contact',
    title: 'Contact',
    roles: NON_MANAGER_ROLES,
    planned: ['Send technical issues and bug reports to the Site Managers'],
  },
]

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/account" element={<AccountPage />} />
              {PLACEHOLDERS.map(({ path, title, planned, roles }) => {
                const page = <PlaceholderPage title={title} planned={planned} />
                return (
                  <Route
                    key={path}
                    path={path}
                    element={roles ? <RequireRole roles={roles}>{page}</RequireRole> : page}
                  />
                )
              })}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
