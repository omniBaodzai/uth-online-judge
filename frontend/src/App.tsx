
import HomePage from './features/home/pages/HomePage'
import AuthPage from './features/auth/pages/AuthPage'
import ProblemsPage from './features/problems/pages/ProblemsPage'
import SubmissionsPage from './features/submissions/pages/SubmissionsPage'
import ContestsPage from './features/contests/pages/ContestsPage'
import LeaderboardPage from './features/leaderboard/pages/LeaderboardPage'
import ProblemDetailPage from './features/problems/pages/ProblemDetailPage'
import ContestDetailPage from './features/contests/pages/ContestDetailPage'
import ProfilePage from './features/profile/pages/ProfilePage'
import ProblemSubmitPage from './features/problems/pages/ProblemSubmitPage'
import './App.css'

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  if (pathname === '/register') {
    return <AuthPage mode="register" />
  }

  if (pathname === '/login') {
    return <AuthPage mode="login" />
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
    return <ProfilePage username={username} />
  }

  return <HomePage />
}

export default App
