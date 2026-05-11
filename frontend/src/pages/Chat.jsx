import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import './pageLayout.css';
import './Chat.css';

function fmtTime(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function preview(text) {
  if (!text) return '';
  const trimmed = String(text).trim().replace(/\s+/g, ' ');
  return trimmed.length > 60 ? `${trimmed.slice(0, 58)}…` : trimmed;
}

function Initials({ name }) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const text =
    parts.length === 0
      ? '?'
      : parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return <span className="chat-avatar">{text}</span>;
}

const EPHEMERAL_TTL_FALLBACK = 60;

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState({ partner: null, messages: [], ephemeralTtlSeconds: EPHEMERAL_TTL_FALLBACK });
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef(null);
  const seenSentRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch('/api/messages');
        if (cancelled) return;
        setConversations(list);
        if (list.length > 0 && !active) {
          setActive(list[0].partner.id);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load conversations');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Loading a thread + polling so messages disappear naturally as their TTL
  // expires server-side (we re-fetch every ~5 seconds while the thread is open).
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setLoadingThread(true);
    seenSentRef.current = new Set();
    const fetchThread = async () => {
      try {
        const data = await apiFetch(`/api/messages/${active}`);
        if (!cancelled) {
          setThread(data);
          setLoadingThread(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load thread');
          setLoadingThread(false);
        }
      }
    };
    fetchThread();
    const id = window.setInterval(fetchThread, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active]);

  // Tick-tock for the ephemeral countdown badges.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread.messages.length]);

  // Auto-mark incoming messages as seen the first time we render them.
  useEffect(() => {
    if (!thread.messages || thread.messages.length === 0) return;
    const toMark = thread.messages.filter(
      (m) =>
        m.recipient_id === user.id &&
        !m.seen_at &&
        !seenSentRef.current.has(m.id)
    );
    if (toMark.length === 0) return;
    toMark.forEach((m) => seenSentRef.current.add(m.id));
    (async () => {
      const updates = await Promise.all(
        toMark.map((m) =>
          apiFetch(`/api/messages/${m.id}/seen`, { method: 'POST' }).catch(() => null)
        )
      );
      const updatedMap = new Map();
      updates.forEach((u) => u && updatedMap.set(u.id, u));
      if (updatedMap.size === 0) return;
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => updatedMap.get(m.id) || m),
      }));
    })();
  }, [thread.messages, user.id]);

  async function send(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !active) return;
    setSending(true);
    setError('');
    try {
      const msg = await apiFetch('/api/messages', {
        method: 'POST',
        body: { recipientId: active, body: text },
      });
      setThread((t) => ({ ...t, messages: [...t.messages, msg] }));
      setBody('');
      const list = await apiFetch('/api/messages');
      setConversations(list);
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  async function toggleSave(m) {
    const next = !m.saved;
    try {
      const updated = await apiFetch(`/api/messages/${m.id}/save`, {
        method: 'POST',
        body: { saved: next },
      });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((x) => (x.id === m.id ? { ...x, ...updated } : x)),
      }));
    } catch (err) {
      setError(err.message || 'Could not save message');
    }
  }

  return (
    <div className="stack fade-up">
      <header className="page-header">
        <p className="eyebrow">Chat</p>
        <h1 className="page-title">Coach &amp; team messages</h1>
        <p className="page-lead">
          Direct line to your coach (or your athletes if you're coaching). Keep the form checks on the rails.
        </p>
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      <div className="chat">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <span className="muted" style={{ fontWeight: 600 }}>Conversations</span>
            <span className="muted">{conversations.length}</span>
          </div>
          {conversations.length === 0 ? (
            <div className="empty" style={{ padding: 'var(--s-6) var(--s-3)' }}>
              <span className="empty-icon">
                <Icon name="message" size={20} />
              </span>
              <h3>No threads yet</h3>
              <p>
                Athletes message their coach automatically. Coaches see all their athletes here.
              </p>
            </div>
          ) : (
            <ul className="chat-list">
              {conversations.map((c) => {
                const isActive = c.partner.id === active;
                const lastFromMe = c.last && c.last.sender_id === user.id;
                return (
                  <li key={c.partner.id}>
                    <button
                      type="button"
                      className={`chat-list-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => setActive(c.partner.id)}
                    >
                      <Initials name={c.partner.full_name} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="chat-list-top">
                          <span className="chat-list-name">{c.partner.full_name}</span>
                          <span className="chat-list-time">
                            {c.last ? fmtTime(c.last.created_at) : ''}
                          </span>
                        </div>
                        <div className="chat-list-preview">
                          {c.last ? (
                            <>
                              {lastFromMe && <span className="dim">You: </span>}
                              {preview(c.last.body)}
                            </>
                          ) : (
                            <span className="dim">No messages yet</span>
                          )}
                        </div>
                      </div>
                      <span className={`badge badge-${c.partner.role}`}>{c.partner.role}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="chat-thread">
          {!active || !thread.partner ? (
            <div className="chat-empty-state">
              <span className="empty-icon">
                <Icon name="message" size={20} />
              </span>
              <h3>Pick a conversation</h3>
              <p>Select a thread on the left to start chatting.</p>
            </div>
          ) : (
            <>
              <header className="chat-thread-header">
                <Initials name={thread.partner.full_name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{thread.partner.full_name}</div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    <span className={`badge badge-${thread.partner.role}`}>{thread.partner.role}</span>
                  </div>
                </div>
              </header>

              <div className="chat-ephemeral-banner muted">
                <Icon name="clock" size={14} />
                <span>
                  Snap-style chat — once seen, messages auto-delete after{' '}
                  {thread.ephemeralTtlSeconds || EPHEMERAL_TTL_FALLBACK}s. Tap the star to save one before it
                  disappears.
                </span>
              </div>

              <div className="chat-messages" ref={scrollRef}>
                {loadingThread ? (
                  <div className="skeleton" style={{ height: 60, margin: 'var(--s-3) 0' }} />
                ) : thread.messages.length === 0 ? (
                  <p className="muted text-center" style={{ padding: 'var(--s-6)' }}>
                    Say hello.
                  </p>
                ) : (
                  thread.messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    const ttl = thread.ephemeralTtlSeconds || EPHEMERAL_TTL_FALLBACK;
                    let countdown = null;
                    let isExpiring = false;
                    if (m.seen_at && !m.saved) {
                      const seenAtMs = new Date(m.seen_at).getTime();
                      const remainingMs = seenAtMs + ttl * 1000 - now;
                      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
                      countdown = remaining;
                      isExpiring = true;
                    }
                    return (
                      <div
                        key={m.id}
                        className={`chat-bubble ${mine ? 'mine' : 'theirs'}${
                          m.saved ? ' is-saved' : ''
                        }${isExpiring ? ' is-expiring' : ''}`}
                        style={
                          isExpiring && countdown != null
                            ? { opacity: Math.max(0.45, countdown / ttl) }
                            : undefined
                        }
                      >
                        <div className="chat-bubble-body">{m.body}</div>
                        <div className="chat-bubble-meta">
                          <span className="chat-bubble-time">{fmtTime(m.created_at)}</span>
                          {m.saved ? (
                            <span className="chat-tag chat-tag-saved" title="Saved permanently">
                              ★ Saved
                            </span>
                          ) : isExpiring ? (
                            <span
                              className="chat-tag chat-tag-expiring"
                              title="Message will self-destruct"
                            >
                              ⏳ {countdown}s
                            </span>
                          ) : mine ? null : (
                            <span className="chat-tag chat-tag-new" title="Not yet seen">
                              new
                            </span>
                          )}
                          <button
                            type="button"
                            className="chat-bubble-action"
                            onClick={() => toggleSave(m)}
                            title={m.saved ? 'Unsave message' : 'Save before it disappears'}
                          >
                            {m.saved ? '★' : '☆'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="chat-composer" onSubmit={send}>
                <textarea
                  className="textarea"
                  rows={1}
                  placeholder={`Message ${thread.partner.full_name}…`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  style={{ minHeight: 44 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending || !body.trim()}
                >
                  <Icon name="send" size={16} />
                  <span className="hidden-sm">Send</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
