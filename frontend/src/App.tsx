import { BrowserRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import HomePage from './features/home/pages/HomePage'
import AuthPage from './features/auth/pages/AuthPage'
import ProblemsPage from './features/problems/pages/ProblemsPage'
import SubmissionsPage from './features/submissions/pages/SubmissionsPage'
import SubmissionDetailPage from './features/submissions/pages/SubmissionDetailPage'
import ContestsPage from './features/contests/pages/ContestsPage'
import LeaderboardPage from './features/leaderboard/pages/LeaderboardPage'
import ProblemDetailPage from './features/problems/pages/ProblemDetailPage'
import ContestDetailPage from './features/contests/pages/ContestDetailPage'
import ProblemSubmitPage from './features/problems/pages/ProblemSubmitPage'
import AccountProfilePage from './features/profile/pages/AccountProfilePage'
import MemberProfilePage from './features/profile/pages/MemberProfilePage'
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage'
import SiteHeader from './components/layout/SiteHeader'
import OrganizationsPage from './features/organizations/pages/OrganizationsPage'
import OrganizationDetailPage from './features/organizations/pages/OrganizationDetailPage'
import type { OrganizationTab } from './features/organizations/data'
import './App.css'

function AppRoutes() {
  const { pathname: currentPathname } = useLocation()
  const pathname = currentPathname.replace(/\/+$/, '') || '/'

  if (pathname === '/register') {
    return <AuthPage mode="register" />
  }

  if (pathname === '/login') {
    return <AuthPage mode="login" />
  }

  if (pathname === '/forgot-password') {
    return (
      <>
        <SiteHeader />
        <ForgotPasswordPage />
      </>
    )
  }

  if (pathname === '/problems') {
    return <ProblemsPage />
  }

  const submitMatch = pathname.match(/^\/problems\/([^/]+)\/submit$/)
  if (submitMatch) {
    const problemId = decodeURIComponent(submitMatch[1]).toUpperCase()
    return <ProblemSubmitPage problemId={problemId} />
  }

  if (pathname.startsWith('/problems/')) {
    const problemId = decodeURIComponent(pathname.slice('/problems/'.length)).toUpperCase()
    return <ProblemDetailPage problemId={problemId} />
  }

  if (pathname === '/submissions') {
    return <SubmissionsPage />
  }

  const submissionMatch = pathname.match(/^\/submissions\/([^/]+)$/)
  if (submissionMatch) {
    return <SubmissionDetailPage submissionId={decodeURIComponent(submissionMatch[1])} />
  }

  if (pathname === '/contests') {
    return <ContestsPage />
  }

  if (pathname.startsWith('/contests/')) {
    const contestId = decodeURIComponent(pathname.slice('/contests/'.length))
    return <ContestDetailPage contestId={contestId} />
  }

  if (pathname === '/leaderboard' || pathname === '/members') {
    return <LeaderboardPage />
  }

  if (pathname.startsWith('/profile/')) {
    const username = decodeURIComponent(pathname.slice('/profile/'.length))
    if (username === 'edit') return <AccountProfilePage edit />
    return <MemberProfilePage username={username} />
  }

  if (pathname === '/profile') {
    return <AccountProfilePage />
  }

  if (pathname === '/organizations') {
    return <OrganizationsPage />
  }

  const organizationMatch = pathname.match(/^\/organizations\/([^/]+)(?:\/(members|problems|contests|submissions))?$/)
  if (organizationMatch) {
    return (
      <OrganizationDetailPage
        organizationId={decodeURIComponent(organizationMatch[1])}
        tab={(organizationMatch[2] as OrganizationTab | undefined) ?? 'home'}
      />
    )
  }

  return <HomePage />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
