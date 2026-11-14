import { lazy } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './features/auth/components/RequireAuth'
import { AuthProvider } from './features/auth/AuthContext'
import AppLayout from './components/layout/AppLayout'
import PlaceholderPage from './components/layout/PlaceholderPage'
import NotFoundPage from './components/layout/NotFoundPage'
import AdminLayout from './features/admin/layouts/AdminLayout'
import { ToastProvider } from './components/ui/Toast'
import { AdminProvider } from './features/admin/AdminContext'
import { RequireAdmin } from './features/admin/components/RequireAdmin'
import AdminLocaleBoundary from './features/admin/AdminLocaleBoundary'
import RouteLoadBoundary from './components/layout/RouteLoadBoundary'
import './App.css'

const HomePage = lazy(() => import('./features/home/pages/HomePage'))
const AuthPage = lazy(() => import('./features/auth/pages/AuthPage'))
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/ForgotPasswordPage'))
const ProblemsPage = lazy(() => import('./features/problems/pages/ProblemsPage'))
const ProblemDetailPage = lazy(() => import('./features/problems/pages/ProblemDetailPage'))
const SubmitSolutionPage = lazy(() => import('./features/problems/pages/SubmitSolutionPage'))
const ProblemSolutionPage = lazy(() => import('./features/problems/pages/ProblemSolutionPage'))
const SubmissionsPage = lazy(() => import('./features/submissions/pages/SubmissionsPage'))
const SubmissionDetailsPage = lazy(() => import('./features/submissions/pages/SubmissionDetailsPage'))
const MyProblemSubmissionsPage = lazy(() => import('./features/submissions/pages/MyProblemSubmissionsPage'))
const BestSubmissionsPage = lazy(() => import('./features/submissions/pages/BestSubmissionsPage'))
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage'))
const ProfileEditPage = lazy(() => import('./features/profile/pages/ProfileEditPage'))
const PublicProfilePage = lazy(() => import('./features/profile/pages/PublicProfilePage'))
const AdminDashboardPage = lazy(() => import('./features/admin/pages/AdminDashboardPage'))
const AdminLoginPage = lazy(() => import('./features/admin/pages/AdminLoginPage'))
const AdminProblemFormPage = lazy(() => import('./features/admin/pages/AdminProblemFormPage'))
const AdminProblemsPage = lazy(() => import('./features/admin/pages/AdminProblemsPage'))
const AdminContestsPage = lazy(() => import('./features/admin/contests/AdminContestsPage'))
const AdminContestFormPage = lazy(() => import('./features/admin/contests/AdminContestFormPage'))
const AdminTestCasesPage = lazy(() => import('./features/admin/pages/AdminTestCasesPage'))
const AdminUsersPage = lazy(() => import('./features/admin/pages/AdminUsersPage'))
const AdminNewsPage = lazy(() => import('./features/admin/pages/AdminNewsPage'))
const AdminNewsFormPage = lazy(() => import('./features/admin/pages/AdminNewsFormPage'))
const AdminContactMessageDetailPage = lazy(() => import('./features/admin/contact-messages/AdminContactMessageDetailPage'))
const AdminContactMessagesPage = lazy(() => import('./features/admin/contact-messages/AdminContactMessagesPage'))
const UserContactMessageDetailsPage = lazy(() => import('./features/contact/pages/UserContactMessageDetailsPage'))
const NewsListPage = lazy(() => import('./features/community/pages/NewsListPage'))
const NewsDetailPage = lazy(() => import('./features/community/pages/NewsDetailPage'))
const DiscussionListPage = lazy(() => import('./features/community/pages/DiscussionListPage'))
const DiscussionDetailPage = lazy(() => import('./features/community/pages/DiscussionDetailPage'))
const DiscussionNewPage = lazy(() => import('./features/community/pages/DiscussionNewPage'))
const LeaderboardPage = lazy(() => import('./features/leaderboard/pages/LeaderboardPage'))
const ContributorsPage = lazy(() => import('./features/contributors/pages/ContributorsPage'))
const OrganizationsPage = lazy(() => import('./features/organizations/pages/OrganizationsPage'))
const OrganizationDetailPage = lazy(() => import('./features/organizations/pages/OrganizationDetailPage'))
const OrganizationManagePage = lazy(() => import('./features/organizations/pages/OrganizationManagePage'))
const OrganizationPreviewPage = lazy(() => import('./features/organizations/pages/OrganizationPreviewPage'))
const OrganizationSubmitPage = lazy(() => import('./features/organizations/pages/OrganizationSubmitPage'))
const OrganizationSubmissionPage = lazy(() => import('./features/organizations/pages/OrganizationSubmissionPage'))
const OrganizationSubmissionsPanel = lazy(() => import('./features/organizations/components/OrganizationSubmissionsPanel'))
const AdminOrganizationsPage = lazy(() => import('./features/admin/organizations/AdminOrganizationsPage'))
const AdminOrganizationRequestDetailPage = lazy(() => import('./features/admin/organizations/AdminOrganizationRequestDetailPage'))
const AdminOrganizationDetailPage = lazy(() => import('./features/admin/organizations/AdminOrganizationDetailPage'))
const ContestsPage = lazy(() => import('./features/contests/pages/ContestsPage'))
const ContestDetailPage = lazy(() => import('./features/contests/pages/ContestDetailPage'))
const ContactPage = lazy(() => import('./features/contact/pages/ContactPage'))

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Routes>
        <Route element={<AuthProvider><Outlet /></AuthProvider>}>
          <Route path="/admin/login" element={<RouteLoadBoundary><AdminLocaleBoundary><AdminLoginPage /></AdminLocaleBoundary></RouteLoadBoundary>} />
          <Route element={<AdminLocaleBoundary><RequireAdmin /></AdminLocaleBoundary>}>
            <Route path="/admin" element={<AdminProvider><AdminLayout /></AdminProvider>}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="problems" element={<AdminProblemsPage />} />
              <Route path="problems/new" element={<AdminProblemFormPage />} />
              <Route path="problems/:id/edit" element={<AdminProblemFormPage />} />
              <Route path="problems/:id/test-cases" element={<AdminTestCasesPage />} />
              <Route path="contests" element={<AdminContestsPage />} />
              <Route path="contests/new" element={<AdminContestFormPage />} />
              <Route path="contests/:contestId/edit" element={<AdminContestFormPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="contact-messages/:messageId" element={<AdminContactMessageDetailPage />} />
              <Route path="contact-messages" element={<AdminContactMessagesPage />} />
              <Route path="organizations" element={<AdminOrganizationsPage />} />
              <Route path="organizations/:id" element={<AdminOrganizationDetailPage />} />
              <Route path="organization-requests/:id" element={<AdminOrganizationRequestDetailPage />} />
              <Route path="news" element={<AdminNewsPage />} />
              <Route path="news/new" element={<AdminNewsFormPage />} />
              <Route path="news/:id/edit" element={<AdminNewsFormPage />} />
            </Route>
          </Route>
        </Route>
        <Route element={<AuthProvider><AppLayout /></AuthProvider>}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/edit" element={<ProfileEditPage />} />
          <Route path="users/id/:id" element={<PublicProfilePage />} />
          <Route path="users/:username" element={<PublicProfilePage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="problems/:code" element={<ProblemDetailPage />} />
          <Route
            path="problems/:code/submit"
            element={<RequireAuth><SubmitSolutionPage /></RequireAuth>}
          />
          <Route
            path="contests/:contestId/problems/:code"
            element={<RequireAuth><ProblemDetailPage /></RequireAuth>}
          />
          <Route
            path="contests/:contestId/problems/:code/submit"
            element={<RequireAuth><SubmitSolutionPage /></RequireAuth>}
          />
          <Route path="problems/:code/pdf" element={<PlaceholderPage titleKey="problemPdf" />} />
          <Route path="problems/:code/submissions" element={<SubmissionsPage />} />
          <Route path="problems/:code/best-submissions" element={<BestSubmissionsPage />} />
          <Route
            path="problems/:code/submissions/me"
            element={<RequireAuth><MyProblemSubmissionsPage /></RequireAuth>}
          />
          <Route path="problems/:code/submissions/best" element={<BestSubmissionsPage />} />
          <Route
            path="problems/:code/solution"
            element={<RequireAuth><ProblemSolutionPage /></RequireAuth>}
          />
          <Route path="contests" element={<ContestsPage />} />
          <Route path="contests/:contestId" element={<ContestDetailPage />} />
          <Route
            path="submissions/:submissionId"
            element={<RequireAuth><SubmissionDetailsPage /></RequireAuth>}
          />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route
            path="organizations/:organizationId/problems/:problemId/submit"
            element={<RequireAuth><OrganizationSubmitPage /></RequireAuth>}
          />
          <Route
            path="organizations/:organizationId/contests/:contestId/problems/:problemId/submit"
            element={<RequireAuth><OrganizationSubmitPage /></RequireAuth>}
          />
          <Route path="organizations/:organizationId/submissions" element={<OrganizationSubmissionsPanel canViewSubmissions />} />
          <Route
            path="organizations/:organizationId/submissions/mine"
            element={<RequireAuth><OrganizationSubmissionsPanel canViewSubmissions mySubmissions /></RequireAuth>}
          />
          <Route path="organizations/:organizationId/submissions/:submissionId" element={<OrganizationSubmissionPage />} />
          <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
          <Route
            path="organizations/:organizationId/manage"
            element={<RequireAuth><OrganizationManagePage /></RequireAuth>}
          />
          {import.meta.env.DEV && <Route path="dev/organization-preview" element={<OrganizationPreviewPage />} />}
          <Route path="contact" element={<ContactPage />} />
          <Route
            path="my/contact-messages/:messageId"
            element={<RequireAuth><UserContactMessageDetailsPage /></RequireAuth>}
          />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                    <Route path="contributors" element={<ContributorsPage />} />
          <Route path="news" element={<NewsListPage />} />
          <Route path="news/:slug" element={<NewsDetailPage />} />
          <Route path="discussions" element={<DiscussionListPage />} />
          <Route path="discussions/new" element={<RequireAuth><DiscussionNewPage /></RequireAuth>} />
          <Route path="discussions/:id" element={<DiscussionDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
