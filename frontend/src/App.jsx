import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Workouts from './pages/Workouts';
import WorkoutLibrary from './pages/WorkoutLibrary';
import Progress from './pages/Progress';
import Meals from './pages/Meals';
import Chat from './pages/Chat';
import CoachHome from './pages/CoachHome';
import AdminHome from './pages/AdminHome';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Reels from './pages/Reels';
import Privacy from './pages/Privacy';
import Support from './pages/Support';
import NotFound from './pages/NotFound';

function AthleteDashboardGate() {
  const { user } = useAuth();
  if (user.role === 'coach') return <Navigate to="/coach" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Dashboard />;
}

function CoachOrAdminGate({ children }) {
  const { user } = useAuth();
  if (user.role === 'athlete') return <Navigate to="/dashboard" replace />;
  return children;
}

function AdminOnlyGate({ children }) {
  const { user } = useAuth();
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/support" element={<Support />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<AthleteDashboardGate />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/library" element={<WorkoutLibrary />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/friends" element={<Friends />} />
            <Route
              path="/coach"
              element={
                <CoachOrAdminGate>
                  <CoachHome />
                </CoachOrAdminGate>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminOnlyGate>
                  <AdminHome />
                </AdminOnlyGate>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
