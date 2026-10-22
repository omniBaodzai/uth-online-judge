import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './features/home/pages/HomePage'
import AuthPage from './features/auth/pages/AuthPage'
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage'
import ProfilePage from './features/profile/pages/ProfilePage'
import { AuthProvider } from './features/auth/AuthContext'
import AppLayout from './components/layout/AppLayout'
import PlaceholderPage from './components/layout/PlaceholderPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/edit" element={<ProfilePage edit />} />
            <Route path="problems" element={<PlaceholderPage title="Bài tập" />} />
            <Route path="contests" element={<PlaceholderPage title="Cuộc thi" />} />
            <Route path="submissions" element={<PlaceholderPage title="Bảng chấm bài" />} />
            <Route path="organizations" element={<PlaceholderPage title="Tổ chức" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
