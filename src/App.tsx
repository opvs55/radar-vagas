import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AuthPage from '@/pages/AuthPage'
import AppLayout from '@/components/layout/AppLayout'
import RadarPage from '@/pages/RadarPage'
import ProfilePage from '@/pages/ProfilePage'
import SearchZonePage from '@/pages/SearchZonePage'
import ApplicationsPage from '@/pages/ApplicationsPage'
import CareerPage from '@/pages/CareerPage'
import OnboardingPage from '@/pages/OnboardingPage'
import InsightsPage from '@/pages/InsightsPage'
import OnboardingFirstJobPage from '@/pages/OnboardingFirstJobPage'
import CoursesPage from '@/pages/CoursesPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <span className="text-gray-400 text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/onboarding/primeiro-emprego" element={<OnboardingFirstJobPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/radar" replace />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/zona-de-busca" element={<SearchZonePage />} />
        <Route path="/candidaturas" element={<ApplicationsPage />} />
        <Route path="/carreira" element={<CareerPage />} />
        <Route path="/mercado" element={<InsightsPage />} />
        <Route path="/cursos" element={<CoursesPage />} />
        <Route path="*" element={<Navigate to="/radar" replace />} />
      </Route>
    </Routes>
  )
}
