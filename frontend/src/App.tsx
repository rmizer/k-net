import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { MANAGER_ROLES, type Role } from './auth/roles'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { AccountPage } from './pages/AccountPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { CrewFinderPage } from './pages/crew/CrewFinderPage'
import { CrewPage } from './pages/crew/CrewPage'
import { DirectoryPage } from './pages/directory/DirectoryPage'
import { InfluencerProfilePage } from './pages/influencers/InfluencerProfilePage'
import { InfluencersPage } from './pages/influencers/InfluencersPage'
import { ResourcesPage } from './pages/resources/ResourcesPage'
import { SchedulePage } from './pages/schedule/SchedulePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

const NON_MANAGER_ROLES: Role[] = ['director', 'assistant', 'staff']

// Pages not built yet, with the contents planned for each (from the site plan).
const PLACEHOLDERS: { path: string; title: string; planned: string[]; roles?: Role[] }[] = [
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
          {/* Login stands alone: no header, nav or footer. */}
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/directory" element={<DirectoryPage />} />
              <Route path="/crew" element={<CrewPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/influencers" element={<InfluencersPage />} />
              <Route path="/influencers/:id" element={<InfluencerProfilePage />} />
              <Route path="/crew/finder" element={<CrewFinderPage />} />
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
