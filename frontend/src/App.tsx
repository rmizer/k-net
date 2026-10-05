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
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { FinanceOverviewPage } from './pages/finance/FinanceOverviewPage'
import { IncomingPage } from './pages/finance/IncomingPage'
import { InvoicesPage } from './pages/finance/InvoicesPage'
import { OutgoingPage } from './pages/finance/OutgoingPage'
import { PaymentOptionsPage } from './pages/finance/PaymentOptionsPage'
import { PayrollPage } from './pages/finance/PayrollPage'
import { PayrollPersonPage } from './pages/finance/PayrollPersonPage'
import { InfluencerProfilePage } from './pages/influencers/InfluencerProfilePage'
import { InfluencersPage } from './pages/influencers/InfluencersPage'
import { LocationsPage } from './pages/locations/LocationsPage'
import { ResourcesPage } from './pages/resources/ResourcesPage'
import { MyTasksPage } from './pages/schedule/MyTasksPage'
import { SchedulePage } from './pages/schedule/SchedulePage'
import { SchedulingPage } from './pages/staff-manager/SchedulingPage'
import { StaffOverviewPage } from './pages/staff-manager/StaffOverviewPage'
import { TaskManagementPage } from './pages/staff-manager/TaskManagementPage'
import { TimelinePage } from './pages/schedule/TimelinePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

const NON_MANAGER_ROLES: Role[] = ['director', 'assistant', 'staff']

// Pages not built yet, with the contents planned for each (from the site plan).
const PLACEHOLDERS: { path: string; title: string; planned: string[]; roles?: Role[] }[] = [












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
              <Route path="/schedule/tasks" element={<MyTasksPage />} />
              <Route path="/schedule/timeline" element={<TimelinePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route element={<RequireRole roles={MANAGER_ROLES} />}>
                <Route path="/finance" element={<FinanceOverviewPage />} />
                <Route path="/finance/payroll" element={<PayrollPage />} />
                <Route path="/finance/payroll/:id" element={<PayrollPersonPage />} />
                <Route path="/finance/incoming" element={<IncomingPage />} />
                <Route path="/finance/outgoing" element={<OutgoingPage />} />
                <Route path="/finance/invoices" element={<InvoicesPage />} />
                <Route path="/finance/payment-options" element={<PaymentOptionsPage />} />
                <Route path="/staff-manager" element={<StaffOverviewPage />} />
                <Route path="/staff-manager/scheduling" element={<SchedulingPage />} />
                <Route path="/staff-manager/tasks" element={<TaskManagementPage />} />
              </Route>
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
