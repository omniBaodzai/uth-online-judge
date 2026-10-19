
import HomePage from './features/home/pages/HomePage'
import AuthPage from './features/auth/pages/AuthPage'
import './App.css'

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  if (pathname === '/register') {
    return <AuthPage mode="register" />
  }

  if (pathname === '/login') {
    return <AuthPage mode="login" />
  }

  return <HomePage />
}

export default App
