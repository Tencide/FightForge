import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './pageLayout.css';

function postLoginPath(role) {
  if (role === 'athlete') return '/dashboard';
  if (role === 'coach' || role === 'admin') return '/workouts';
  return '/';
}

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

  return (
    <div className="stack" style={{ maxWidth: 440 }}>
      <h1 className="page-title">Log in</h1>
      <p className="page-lead">Use your FightForge account. Demo accounts are in the README after seeding.</p>
      <form className="form" onSubmit={onSubmit}>
        <label className="label">
          Email
          <input
            className="input"
            type="email"
            autoComplete="username"
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
        </button>
      </form>
      <p className="muted">
        New here? <Link to="/signup">Create an account</Link> (signup page owned by teammate).
      </p>
      <p className="muted">
        <Link to="/">← Back to home</Link>
      </p>
    </div>
  );
}
