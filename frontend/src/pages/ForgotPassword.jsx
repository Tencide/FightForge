import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, wakeApi } from '../api/client';
import Icon from '../components/Icon';
import './pageLayout.css';
import './AuthLayout.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await wakeApi();
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      setSent(true);
      if (res?.devResetLink) setDevLink(res.devResetLink);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell fade-up">
      <div className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
          Forgot your password?
        </h1>

        {sent ? (
          <>
            <p className="muted">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset
              your password. The link expires in 30 minutes.
            </p>
            {devLink ? (
              <p className="muted" style={{ wordBreak: 'break-all' }}>
                Dev mode (no email configured): <Link to={devLink.replace(/^https?:\/\/[^/]+/, '')}>open reset link</Link>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="muted">
              Enter your account email and we&apos;ll send you a link to set a new password.
            </p>
            <form
              className="form"
              onSubmit={onSubmit}
              style={{ marginTop: 'var(--s-3)', maxWidth: 'unset' }}
            >
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
              {error ? (
                <p className="error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
                {!loading && <Icon name="arrowRight" size={16} />}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="auth-aside">
        <p className="muted" style={{ margin: 0 }}>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
