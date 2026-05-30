import { useState } from 'react';
import { Link } from 'react-router-dom';
import './pageLayout.css';
import './Legal.css';

const SUPPORT_EMAIL = 'craigomozeje@gmail.com';

export default function Support() {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const lines = [
      message,
      '',
      '---',
      name ? `From: ${name}` : null,
      from ? `Reply-to: ${from}` : null,
    ].filter((l) => l !== null);

    const mailtoSubject = subject.trim() || 'FightForge support request';
    const url =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(mailtoSubject)}` +
      `&body=${encodeURIComponent(lines.join('\n'))}`;

    // Opens the user's email client with the message prefilled.
    window.location.href = url;
    setSent(true);
  };

  return (
    <div className="legal-page stack fade-up">
      <header className="page-header">
        <p className="eyebrow">Help</p>
        <h1 className="page-title">Support</h1>
        <p className="page-lead">
          Have a question, found a bug, or need help with your account? Send us a message and we&apos;ll
          get back to you.
        </p>
      </header>

      <form className="form-card stack" onSubmit={handleSubmit}>
        <label className="label">
          Your name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="label">
          Your email
          <input
            className="input"
            type="email"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="So we can reply"
          />
        </label>

        <label className="label">
          Subject
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
          />
        </label>

        <label className="label">
          Message
          <textarea
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={5}
            placeholder="Tell us what's going on…"
          />
        </label>

        <button type="submit" className="btn btn-primary">
          Send message
        </button>

        {sent ? (
          <p className="muted" style={{ margin: 0 }}>
            Your email app should have opened. If it didn&apos;t, email us directly at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Prefer your own email app? Reach us anytime at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        )}
      </form>

      <div className="cluster">
        <Link to="/privacy" className="btn-link">
          Privacy Policy
        </Link>
        <Link to="/" className="btn-link">
          Back to FightForge
        </Link>
      </div>
    </div>
  );
}
