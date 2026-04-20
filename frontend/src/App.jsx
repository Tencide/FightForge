import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PartnerPlaceholder from './pages/PartnerPlaceholder';
import NotFound from './pages/NotFound';

function Landing() {
  return (
    <PartnerPlaceholder title="FightForge">
      Feature pages (home, login, dashboard, workouts, progress) mount here as their branches are merged.
    </PartnerPlaceholder>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Feature routes are registered on their respective branches:
              /            -> feat/frontend-home
              /login       -> feat/frontend-login
              /dashboard   -> feat/frontend-athlete-dashboard
              /workouts    -> feat/frontend-workouts-ui
              /progress    -> feat/frontend-progress-ui
          */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
