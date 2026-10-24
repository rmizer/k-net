import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { MANAGER_ROLES } from './auth/roles'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { AccountPage } from './pages/AccountPage'
import { CallSheetPage } from './pages/call-sheet/CallSheetPage'
import { PublishedCallSheetPage } from './pages/call-sheet/PublishedCallSheetPage'
import { ContactPage } from './pages/contact/ContactPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { CrewFinderPage } from './pages/crew/CrewFinderPage'
import { CrewPage } from './pages/crew/CrewPage'
import { InvitePage } from './pages/crew/InvitePage'
import { DirectoryPage } from './pages/directory/DirectoryPage'
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { PaperworkPage } from './pages/documents/PaperworkPage'
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
import { CostSummaryPage } from './pages/investors/CostSummaryPage'
import { InvestorPage } from './pages/investors/InvestorPage'
import { LegalPage } from './pages/legal/LegalPage'
import { LocationsPage } from './pages/locations/LocationsPage'
import { DepartmentPage, DepartmentsIndex } from './pages/departments/DepartmentPage'
import { MenuItemFormPage } from './pages/departments/culinary/MenuItemFormPage'
import { FoodAllergiesPage } from './pages/departments/culinary/FoodAllergiesPage'
import { MenuPage } from './pages/departments/culinary/MenuPage'
import { ShoppingListPage } from './pages/departments/culinary/ShoppingListPage'
import { NewShoppingListPage, ShoppingListsPage } from './pages/departments/culinary/ShoppingListsPage'
import { MeetingNoteFormPage } from './pages/meetings/MeetingNoteFormPage'
import { MeetingNotePage } from './pages/meetings/MeetingNotePage'
import { MeetingNotesPage } from './pages/meetings/MeetingNotesPage'
import { ResourcesPage } from './pages/resources/ResourcesPage'
import { ShowPage } from './pages/shows/ShowPage'
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
          <Route path="/for-investors/costs" element={<CostSummaryPage />} />
          <Route path="/investors/:token/costs" element={<CostSummaryPage />} />
          <Route element={<Layout />}>
            {/* Public, so people can read about the trial before signing up. */}
            <Route path="/trial" element={<TrialPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/call-sheets/:id" element={<PublishedCallSheetPage />} />
              <Route path="/directory" element={<DirectoryPage />} />
              {/* Staff / Crew moved under Schedule. */}
              <Route path="/crew" element={<Navigate to="/schedule/crew" replace />} />
              <Route path="/crew/finder" element={<Navigate to="/schedule/crew/finder" replace />} />
              <Route path="/crew/invite" element={<Navigate to="/schedule/crew/invite" replace />} />
              <Route path="/resources" element={<ResourcesPage />} />
              {/* Social Media moved to Marketing, which is now a department page. */}
              <Route path="/social" element={<Navigate to="/departments/marketing" replace />} />
              <Route path="/marketing" element={<Navigate to="/departments/marketing" replace />} />
              {/* Department pages check access themselves (the API does too). */}
              <Route path="/departments" element={<DepartmentsIndex />} />
              <Route path="/departments/culinary/menu" element={<MenuPage />} />
              <Route path="/departments/culinary/menu/new" element={<MenuItemFormPage />} />
              <Route path="/departments/culinary/menu/:id" element={<MenuItemFormPage />} />
              <Route path="/departments/culinary/shopping" element={<ShoppingListsPage />} />
              <Route path="/departments/culinary/shopping/new" element={<NewShoppingListPage />} />
              <Route path="/departments/culinary/shopping/:id" element={<ShoppingListPage />} />
              <Route path="/departments/culinary/allergies" element={<FoodAllergiesPage />} />
              <Route path="/departments/:slug" element={<DepartmentPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/schedule/tasks" element={<MyTasksPage />} />
              <Route path="/schedule/timeline" element={<TimelinePage />} />
              <Route path="/schedule/crew" element={<CrewPage />} />
              <Route path="/schedule/crew/finder" element={<CrewFinderPage />} />
              <Route path="/schedule/crew/invite" element={<InvitePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/paperwork" element={<PaperworkPage />} />
              {/* Finance is a department: only its people and managers get in. */}
              <Route element={<RequireRole departmentPage="finance" />}>
                <Route path="/finance" element={<FinanceOverviewPage />} />
                <Route path="/finance/payroll" element={<PayrollPage />} />
                <Route path="/finance/payroll/:id" element={<PayrollPersonPage />} />
                <Route path="/finance/incoming" element={<IncomingPage />} />
                <Route path="/finance/outgoing" element={<OutgoingPage />} />
                <Route path="/finance/invoices" element={<InvoicesPage />} />
                <Route path="/finance/payment-options" element={<PaymentOptionsPage />} />
              </Route>
              <Route path="/locations" element={<LocationsPage />} />
              <Route element={<RequireRole roles={MANAGER_ROLES} />}>
                <Route path="/staff-manager" element={<StaffOverviewPage />} />
                <Route path="/staff-manager/departments" element={<DepartmentsPage />} />
                <Route path="/staff-manager/scheduling" element={<SchedulingPage />} />
                <Route path="/staff-manager/tasks" element={<TaskManagementPage />} />
                <Route path="/staff-manager/shows" element={<ShowsPage />} />
                <Route path="/staff-manager/shows/:id" element={<ShowPage />} />
                {/* Call sheets live under Scheduling. */}
                <Route path="/staff-manager/scheduling/call-sheet" element={<CallSheetPage />} />
                <Route path="/staff-manager/call-sheet" element={<Navigate to="/staff-manager/scheduling/call-sheet" replace />} />
                <Route path="/meeting-notes" element={<MeetingNotesPage />} />
                <Route path="/meeting-notes/new" element={<MeetingNoteFormPage />} />
                <Route path="/meeting-notes/:id" element={<MeetingNotePage />} />
                <Route path="/meeting-notes/:id/edit" element={<MeetingNoteFormPage />} />
              </Route>
              <Route path="/influencers" element={<InfluencersPage />} />
              <Route path="/influencers/:id" element={<InfluencerProfilePage />} />
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
