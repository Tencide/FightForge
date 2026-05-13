import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { SHOW_DEMO_ACCOUNTS } from '../config';
import './pageLayout.css';
import './AuthLayout.css';

function postLoginPath(role) {
  if (role === 'athlete') return '/dashboard';
  if (role === 'coach') return '/coach';
  if (role === 'admin') return '/admin';
  return '/';
}

const SAMPLE_ACCOUNTS = [
  { email: 'athlete@fightforge.test', label: 'Athlete', badge: 'badge-athlete' },
  { email: 'coach@fightforge.test', label: 'Coach', badge: 'badge-coach' },
  { email: 'admin@fightforge.test', label: 'Admin', badge: 'badge-admin' },
];

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) {
    const target = location.state?.from && location.state.from !== '/login' ? location.state.from : null;
    return <Navigate to={target || postLoginPath(user.role)} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillSample(addr) {
    setEmail(addr);
    setPassword('Password123!');
    setError('');
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
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <Icon name="arrowRight" size={16} />}
          </button>
        </form>

        {SHOW_DEMO_ACCOUNTS && (
          <>
            <div className="divider" />
            <p className="muted" style={{ marginBottom: 'var(--s-2)' }}>
              Quick fill sample accounts (password <span className="mono">Password123!</span>):
            </p>
            <div className="cluster">
              {SAMPLE_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => fillSample(d.email)}
                >
                  <span className={`badge ${d.badge}`} style={{ marginRight: 4 }}>
                    {d.label}
                  </span>
                  {d.email}
                </button>
              ))}
            </div>
          </>
        )}
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
