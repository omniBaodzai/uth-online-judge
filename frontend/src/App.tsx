import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import HomePage from './features/home/pages/HomePage'
import AuthPage from './features/auth/pages/AuthPage'
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage'
import ProblemsPage from './features/problems/pages/ProblemsPage'
import ProblemDetailPage from './features/problems/pages/ProblemDetailPage'
import SubmitSolutionPage from './features/problems/pages/SubmitSolutionPage'
import { RequireAuth } from './features/auth/components/RequireAuth'
import SubmissionsPage from './features/submissions/pages/SubmissionsPage'
import SubmissionDetailsPage from './features/submissions/pages/SubmissionDetailsPage'
import MyProblemSubmissionsPage from './features/submissions/pages/MyProblemSubmissionsPage'
import ProfilePage from './features/profile/pages/ProfilePage'
import { AuthProvider } from './features/auth/AuthContext'
import AppLayout from './components/layout/AppLayout'
import PlaceholderPage from './components/layout/PlaceholderPage'
import AdminLayout from './features/admin/layouts/AdminLayout'
import AdminDashboardPage from './features/admin/pages/AdminDashboardPage'
import AdminLoginPage from './features/admin/pages/AdminLoginPage'
import AdminProblemFormPage from './features/admin/pages/AdminProblemFormPage'
import AdminProblemsPage from './features/admin/pages/AdminProblemsPage'
import AdminTestCasesPage from './features/admin/pages/AdminTestCasesPage'
import AdminUsersPage from './features/admin/pages/AdminUsersPage'
import AdminNewsPage from './features/admin/pages/AdminNewsPage'
import AdminNewsFormPage from './features/admin/pages/AdminNewsFormPage'
import NewsListPage from './features/community/pages/NewsListPage'
import NewsDetailPage from './features/community/pages/NewsDetailPage'
import DiscussionListPage from './features/community/pages/DiscussionListPage'
import DiscussionDetailPage from './features/community/pages/DiscussionDetailPage'
import DiscussionNewPage from './features/community/pages/DiscussionNewPage'
import { ToastProvider } from './components/ui/Toast'
import { AdminProvider } from './features/admin/AdminContext'
import { RequireAdmin } from './features/admin/components/RequireAdmin'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Routes>
        <Route element={<AuthProvider><Outlet /></AuthProvider>}>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminProvider><AdminLayout /></AdminProvider>}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="problems" element={<AdminProblemsPage />} />
              <Route path="problems/new" element={<AdminProblemFormPage />} />
              <Route path="problems/:id/edit" element={<AdminProblemFormPage />} />
              <Route path="problems/:id/test-cases" element={<AdminTestCasesPage />} />
              <Route path="users" element={<AdminUsersPage />} />
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
          <Route path="profile/edit" element={<ProfilePage edit />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="problems/:code" element={<ProblemDetailPage />} />
          <Route
            path="problems/:code/submit"
            element={<RequireAuth><SubmitSolutionPage /></RequireAuth>}
          />
          <Route path="problems/:code/pdf" element={<PlaceholderPage title="Đề bài dạng PDF" />} />
          <Route path="problems/:code/submissions" element={<SubmissionsPage />} />
          <Route
            path="problems/:code/submissions/me"
            element={<RequireAuth><MyProblemSubmissionsPage /></RequireAuth>}
          />
          <Route path="problems/:code/submissions/best" element={<PlaceholderPage title="Bài nộp tốt nhất" />} />
          <Route path="problems/:code/solution" element={<PlaceholderPage title="Lời giải bài tập" />} />
          <Route path="contests" element={<PlaceholderPage title="Cuộc thi" />} />
          <Route
            path="submissions/:submissionId"
            element={<RequireAuth><SubmissionDetailsPage /></RequireAuth>}
          />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="organizations" element={<PlaceholderPage title="Tổ chức" />} />
          <Route path="news" element={<NewsListPage />} />
          <Route path="news/:slug" element={<NewsDetailPage />} />
          <Route path="discussions" element={<DiscussionListPage />} />
          <Route path="discussions/new" element={<RequireAuth><DiscussionNewPage /></RequireAuth>} />
          <Route path="discussions/:id" element={<DiscussionDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
