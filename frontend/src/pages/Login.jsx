import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { wakeApi } from '../api/client';
import Icon from '../components/Icon';
import './pageLayout.css';
import './AuthLayout.css';

function postLoginPath(role) {
  if (role === 'athlete') return '/dashboard';
  if (role === 'coach') return '/coach';
  if (role === 'admin') return '/admin';
  return '/';
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void wakeApi();
  }, []);

  if (isAuthenticated && user) {
    const target = location.state?.from && location.state.from !== '/login' ? location.state.from : null;
    return <Navigate to={target || postLoginPath(user.role)} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStatus('Connecting to server…');
    const slowTimer = window.setTimeout(() => setStatus('Signing in…'), 2500);
    try {
      await Promise.all([wakeApi(), login(email, password)]);
    } catch (err) {
      let msg = err.message || 'Login failed';
      if (import.meta.env.DEV && /could not reach|failed to fetch|load failed|network/i.test(msg)) {
        msg += ' — Is the API running? cd backend && npm start (default http://127.0.0.1:5000).';
      }
      if (
        import.meta.env.PROD &&
        typeof window !== 'undefined' &&
        (window.location.hostname.endsWith('.vercel.app') ||
          window.location.hostname === 'vercel.app' ||
          /^capacitor:/i.test(window.location.protocol) ||
          /^ionic:/i.test(window.location.protocol) ||
          window.location.hostname === 'localhost') &&
        /could not reach|failed to fetch|load failed|network|not configured|html instead of json|cors/i.test(msg)
      ) {
        msg +=
          window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'vercel.app'
            ? ' See docs/VERCEL.md — set VITE_API_BASE and CORS_ORIGIN on your API.'
            : ' See docs/APPLE_APP_STORE.md — redeploy the Fly API with Capacitor CORS, then install a fresh TestFlight build.';
      }
      setError(msg);
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <div className="auth-shell fade-up">
      <div className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
          Log in to FightForge
        </h1>
        <p className="muted">Pick up where your camp left off.</p>

        <form className="form" onSubmit={onSubmit} style={{ marginTop: 'var(--s-3)', maxWidth: 'unset' }}>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="label">
            Password
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? status || 'Signing in…' : 'Sign in'}
            {!loading && <Icon name="arrowRight" size={16} />}
          </button>
        </form>
      </div>

      <div className="auth-aside">
        <p className="muted" style={{ margin: 0 }}>
          New to FightForge?{' '}
          <Link to="/signup">
            Create an account <Icon name="arrowRight" size={12} style={{ verticalAlign: 'middle' }} />
          </Link>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
