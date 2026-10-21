import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { DIRECTOR_ROLES, MANAGER_ROLES } from './auth/roles'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { AccountPage } from './pages/AccountPage'
import { ContactPage } from './pages/contact/ContactPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { CrewFinderPage } from './pages/crew/CrewFinderPage'
import { CrewPage } from './pages/crew/CrewPage'
import { InvitePage } from './pages/crew/InvitePage'
import { DirectoryPage } from './pages/directory/DirectoryPage'
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { HelpArticlePage } from './pages/help/HelpArticlePage'
import { HelpPage } from './pages/help/HelpPage'
import { FinanceOverviewPage } from './pages/finance/FinanceOverviewPage'
import { IncomingPage } from './pages/finance/IncomingPage'
import { InvoicesPage } from './pages/finance/InvoicesPage'
import { OutgoingPage } from './pages/finance/OutgoingPage'
import { PaymentOptionsPage } from './pages/finance/PaymentOptionsPage'
import { PayrollPage } from './pages/finance/PayrollPage'
import { PayrollPersonPage } from './pages/finance/PayrollPersonPage'
import { InfluencerProfilePage } from './pages/influencers/InfluencerProfilePage'
import { InfluencersPage } from './pages/influencers/InfluencersPage'
import { InvestorLinkPage } from './pages/investors/InvestorLinkPage'
import { InvestorPage } from './pages/investors/InvestorPage'
import { LocationsPage } from './pages/locations/LocationsPage'
import { ResourcesPage } from './pages/resources/ResourcesPage'
import { SocialMediaPage } from './pages/social/SocialMediaPage'
import { ShowsPage } from './pages/shows/ShowsPage'
import { SiteManagerPage } from './pages/site-manager/SiteManagerPage'
import { MyTasksPage } from './pages/schedule/MyTasksPage'
import { SchedulePage } from './pages/schedule/SchedulePage'
import { DepartmentsPage } from './pages/staff-manager/DepartmentsPage'
import { SchedulingPage } from './pages/staff-manager/SchedulingPage'
import { StaffOverviewPage } from './pages/staff-manager/StaffOverviewPage'
import { TaskManagementPage } from './pages/staff-manager/TaskManagementPage'
import { TimelinePage } from './pages/schedule/TimelinePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { CheckEmailPage } from './pages/signup/CheckEmailPage'
import { ConfirmEmailPage } from './pages/signup/ConfirmEmailPage'
import { SignupPage } from './pages/signup/SignupPage'
import { VerifyEmailPage } from './pages/signup/VerifyEmailPage'
import { TrialBanner } from './trial/TrialBanner'
import { TrialPage } from './trial/TrialPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <TrialBanner />
          <Routes>
          {/* Login, sign-up and email verification stand alone: no header, nav or footer. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          {/* The private investor page: public to anyone with the link, no site chrome. */}
          <Route path="/for-investors" element={<InvestorPage />} />
          <Route path="/investors/:token" element={<InvestorPage />} />
          <Route element={<Layout />}>
            {/* Public, so people can read about the trial before signing up. */}
            <Route path="/trial" element={<TrialPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/directory" element={<DirectoryPage />} />
              <Route path="/crew" element={<CrewPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/social" element={<SocialMediaPage />} />
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
                <Route path="/staff-manager/departments" element={<DepartmentsPage />} />
                <Route path="/staff-manager/scheduling" element={<SchedulingPage />} />
                <Route path="/staff-manager/tasks" element={<TaskManagementPage />} />
              </Route>
              <Route element={<RequireRole roles={DIRECTOR_ROLES} />}>
                <Route path="/staff-manager/shows" element={<ShowsPage />} />
              </Route>
              <Route path="/influencers" element={<InfluencersPage />} />
              <Route path="/influencers/:id" element={<InfluencerProfilePage />} />
              <Route path="/crew/finder" element={<CrewFinderPage />} />
              <Route path="/crew/invite" element={<InvitePage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/help/:slug" element={<HelpArticlePage />} />
              <Route
                path="/site-manager"
                element={
                  <RequireRole roles={['site_manager']}>
                    <SiteManagerPage />
                  </RequireRole>
                }
              />
              <Route
                path="/investors"
                element={
                  <RequireRole roles={['site_manager']}>
                    <InvestorLinkPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
