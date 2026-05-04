import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Onboarding from './pages/auth/Onboarding'
import Overview from './pages/Overview'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import Matches from './pages/Matches'
import MonthlyChallenge from './pages/MonthlyChallenge'
import NorthStar from './pages/NorthStar'
import AIInsights from './pages/AIInsights'
import History from './pages/History'
import Votes from './pages/Votes'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-cream" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireNorthStar({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-cream" />
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.north_star) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireNorthStar>
            <AppLayout />
          </RequireNorthStar>
        }
      >
        <Route path="/" element={<Overview />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/challenge" element={<MonthlyChallenge />} />
        <Route path="/north-star" element={<NorthStar />} />
        <Route path="/insights" element={<AIInsights />} />
        <Route path="/history" element={<History />} />
        <Route path="/votes" element={<Votes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
