import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import PartnerPlaceholder from './pages/PartnerPlaceholder';
import NotFound from './pages/NotFound';

function Landing() {
  return (
    <PartnerPlaceholder title="FightForge">
      Home page lives on feat/frontend-home — once merged this becomes the real landing view.
    </PartnerPlaceholder>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
