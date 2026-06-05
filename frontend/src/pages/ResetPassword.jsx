import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import Icon from '../components/Icon';
import './pageLayout.css';
import './AuthLayout.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell fade-up">
      <div className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
          Set a new password
        </h1>

        {!token ? (
          <p className="error" role="alert">
            This reset link is missing its token. Please request a new link from the{' '}
            <Link to="/forgot-password">forgot password</Link> page.
          </p>
        ) : done ? (
          <p className="muted">
            Your password has been reset. Redirecting you to sign in…
          </p>
        ) : (
          <form
            className="form"
            onSubmit={onSubmit}
            style={{ marginTop: 'var(--s-3)', maxWidth: 'unset' }}
          >
            <label className="label">
              New password
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="label">
              Confirm new password
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset password'}
              {!loading && <Icon name="arrowRight" size={16} />}
            </button>
          </form>
        )}
      </div>

      <div className="auth-aside">
        <p className="muted" style={{ margin: 0 }}>
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
