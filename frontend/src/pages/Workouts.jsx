import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import YouTubePlayer from '../components/YouTubePlayer';
import { getYouTubeId } from '../utils/youtube';
import './pageLayout.css';

const EMPTY_FORM = {
  title: '',
  description: '',
  content: '',
  videoUrl: '',
  athleteId: '',
};

export default function Workouts() {
  const { user, refreshProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterAthlete, setFilterAthlete] = useState('all');

  const canManage = user.role === 'coach' || user.role === 'admin';
  const isEditing = editingId != null;
  const isAthlete = user.role === 'athlete';
  const [generating, setGenerating] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [xpToast, setXpToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = await apiFetch('/api/workouts');
        if (!cancelled) setItems(w);
        if (canManage) {
          const u = await apiFetch('/api/users');
          if (!cancelled) setUsers(u.filter((x) => x.role === 'athlete'));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load workouts');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const athleteOptions = useMemo(() => users, [users]);

  const filtered = useMemo(() => {
    if (filterAthlete === 'all' || !canManage) return items;
    return items.filter((w) => String(w.athlete_id) === String(filterAthlete));
  }, [items, filterAthlete, canManage]);

  const openWorkout = useMemo(() => items.find((w) => w.id === openId) || null, [items, openId]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(w) {
    setEditingId(w.id);
    setForm({
      title: w.title || '',
      description: w.description || '',
      content: w.content || '',
      videoUrl: w.video_url || '',
      athleteId: String(w.athlete_id || ''),
    });
    setShowForm(true);
    setError('');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }

  async function submitForm(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        content: form.content,
        videoUrl: form.videoUrl,
        athleteId: Number(form.athleteId),
      };
      if (isEditing) {
        await apiFetch(`/api/workouts/${editingId}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/workouts', { method: 'POST', body });
      }
      resetForm();
      const w = await apiFetch('/api/workouts');
      setItems(w);
    } catch (err) {
      setError(err.message || (isEditing ? 'Could not save changes' : 'Could not create workout'));
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkout(id) {
    if (!window.confirm('Delete this workout plan?')) return;
    setError('');
    try {
      await apiFetch(`/api/workouts/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (openId === id) setOpenId(null);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  }

  async function generateToday() {
    setError('');
    setGenerating(true);
    try {
      const created = await apiFetch('/api/workouts/generate-today', { method: 'POST' });
      setItems((prev) => [created, ...prev]);
      setOpenId(created.id);
    } catch (err) {
      setError(err.message || 'Could not generate today\u2019s workout');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleComplete(w) {
    const completed = !w.completed_at;
    setCompletingId(w.id);
    setError('');
    try {
      const updated = await apiFetch(`/api/workouts/${w.id}/complete`, {
        method: 'POST',
        body: { completed },
      });
      setItems((prev) => prev.map((x) => (x.id === w.id ? { ...x, ...updated } : x)));
      if (updated.xp && updated.xp.delta && isAthlete) {
        setXpToast({
          delta: updated.xp.delta,
          overall: updated.xp.overall,
          leveledUp: updated.xp.leveledUp,
        });
        refreshProfile().catch(() => {});
        setTimeout(() => setXpToast(null), 4500);
      }
    } catch (err) {
      setError(err.message || 'Could not update completion');
    } finally {
      setCompletingId(null);
    }
  }

  function formatCompletedDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="stack fade-up">
      {xpToast && (
        <div
          className="success"
          role="status"
          aria-live="polite"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
        >
          <span>
            {xpToast.delta > 0 ? '+' : ''}
            {xpToast.delta} XP
            {xpToast.leveledUp ? ` \u2014 Overall up to ${xpToast.overall}!` : ` \u2014 Overall ${xpToast.overall}`}
          </span>
          <button type="button" className="btn-link" onClick={() => setXpToast(null)}>
            dismiss
          </button>
        </div>
      )}
      <header className="page-header with-actions">
        <div>
          <p className="eyebrow">Workouts</p>
          <h1 className="page-title">Training plans</h1>
          <p className="page-lead">
            {canManage
              ? 'Build, assign, and tweak plans for your athletes. Click a plan to see details and the tutorial video.'
              : 'Plans assigned to you by your coach. Click a plan to see details and watch the tutorial.'}
          </p>
        </div>
        <div className="cluster">
          <Link to="/workouts/library" className="btn btn-subtle">
            <Icon name="notebook" size={16} />
            Browse library
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={generateToday}
            disabled={generating}
            title={
              isAthlete
                ? 'Auto-create today\u2019s session from your profile'
                : 'Auto-create today\u2019s session for yourself'
            }
          >
            <Icon name="flame" size={16} />
            {generating ? 'Generating\u2026' : 'Generate today\u2019s workout'}
          </button>
          {canManage ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setForm(EMPTY_FORM);
                  setEditingId(null);
                  setShowForm(true);
                }
              }}
            >
              <Icon name={showForm ? 'x' : 'plus'} size={16} />
              {showForm ? 'Cancel' : 'New workout'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {canManage && showForm ? (
        <form className="form-card fade-up" onSubmit={submitForm}>
          <h2 className="section-title">
            {isEditing ? 'Edit workout plan' : 'New workout plan'}
          </h2>
          <div className="row">
            <label className="label" style={{ flex: '1 1 240px' }}>
              Athlete
              <select
                className="select"
                required
                value={form.athleteId}
                onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value }))}
              >
                <option value="">Select athlete…</option>
                {athleteOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label" style={{ flex: '2 1 320px' }}>
              Title
              <input
                className="input"
                placeholder="e.g. Striking — Week 2"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
          </div>
          <label className="label">
            Summary
            <input
              className="input"
              placeholder="One-liner shown in the list"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="label">
            Tutorial video URL <span className="dim">(optional)</span>
            <input
              className="input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.videoUrl}
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
            />
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              YouTube full URL, short link, embed link, or video ID — all accepted.
            </span>
          </label>
          <label className="label">
            Session details
            <textarea
              className="textarea"
              placeholder={
                'Full breakdown — sets, rounds, drills.\n' +
                'Example:\n' +
                '- 10 min jump rope\n' +
                '- 4×3 heavy bag\n' +
                '- 3 rounds shadow boxing'
              }
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </label>
          <div className="cluster">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create workout'}
            </button>
            <button type="button" className="btn btn-subtle" onClick={resetForm}>
              {isEditing ? 'Cancel' : 'Discard'}
            </button>
          </div>
        </form>
      ) : null}

      {canManage && athleteOptions.length > 0 ? (
        <div className="cluster">
          <span className="muted">Filter:</span>
          <button
            className={`tab ${filterAthlete === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilterAthlete('all')}
            type="button"
          >
            All ({items.length})
          </button>
          {athleteOptions.map((a) => {
            const count = items.filter((w) => w.athlete_id === a.id).length;
            return (
              <button
                key={a.id}
                type="button"
                className={`tab ${String(filterAthlete) === String(a.id) ? 'is-active' : ''}`}
                onClick={() => setFilterAthlete(a.id)}
              >
                {a.full_name} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="dumbbell" size={20} />
          </span>
          <h3>No workouts to show</h3>
          <p>
            {canManage
              ? 'Create your first workout plan above to get started.'
              : 'Your coach has not assigned any plans yet.'}
          </p>
        </div>
      ) : (
        <ul className="list">
          {filtered.map((w) => {
            const isRowEditing = editingId === w.id;
            const done = !!w.completed_at;
            const canCompleteRow =
              canManage || (isAthlete && w.athlete_id === user.id);
            return (
              <li
                key={w.id}
                className="list-item"
                style={{
                  ...(isRowEditing
                    ? {
                        borderColor: 'var(--accent)',
                        boxShadow: '0 0 0 1px var(--accent)',
                      }
                    : null),
                  ...(done && !isRowEditing
                    ? {
                        borderColor: 'rgba(34,197,94,0.4)',
                        background:
                          'linear-gradient(180deg, rgba(34,197,94,0.05) 0%, transparent 100%)',
                      }
                    : null),
                }}
              >
                <div className="spread">
                  <div style={{ minWidth: 0 }}>
                    <div className="cluster" style={{ marginBottom: 4 }}>
                      <strong
                        style={{
                          fontSize: '1rem',
                          opacity: done ? 0.85 : 1,
                          textDecoration: done ? 'line-through' : 'none',
                          textDecorationColor: 'rgba(34,197,94,0.6)',
                          textDecorationThickness: '2px',
                        }}
                      >
                        {w.title}
                      </strong>
                      {done ? (
                        <span
                          className="badge"
                          style={{
                            color: 'var(--success, #22c55e)',
                            borderColor: 'rgba(34,197,94,0.4)',
                          }}
                          title={`Completed ${new Date(w.completed_at).toLocaleString()}`}
                        >
                          ✓ Done {formatCompletedDate(w.completed_at)}
                        </span>
                      ) : null}
                      {w.video_url ? (
                        <span
                          className="badge"
                          style={{
                            color: 'var(--accent)',
                            borderColor: 'rgba(226,62,87,0.3)',
                          }}
                          title="Tutorial video attached"
                        >
                          ▶ Video
                        </span>
                      ) : null}
                      {isRowEditing ? (
                        <span
                          className="badge"
                          style={{
                            color: 'var(--accent)',
                            borderColor: 'rgba(226,62,87,0.3)',
                          }}
                        >
                          Editing
                        </span>
                      ) : null}
                    </div>
                    <div className="muted">
                      For {w.athlete_name || `user #${w.athlete_id}`}
                    </div>
                    {w.description ? (
                      <p style={{ margin: '0.5rem 0 0' }}>{w.description}</p>
                    ) : null}
                  </div>
                  <div className="cluster">
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => setOpenId(w.id)}
                    >
                      Show details
                    </button>
                    {canCompleteRow ? (
                      <button
                        type="button"
                        className={done ? 'btn btn-subtle btn-sm' : 'btn btn-primary btn-sm'}
                        onClick={() => toggleComplete(w)}
                        disabled={completingId === w.id}
                        title={done ? 'Mark workout as not done' : 'Mark workout as completed'}
                      >
                        <Icon name={done ? 'x' : 'check'} size={14} />
                        {completingId === w.id
                          ? 'Saving\u2026'
                          : done
                          ? 'Undo'
                          : 'Mark done'}
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-subtle btn-sm"
                          onClick={() => startEdit(w)}
                          title="Edit workout"
                        >
                          <Icon name="edit" size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeWorkout(w.id)}
                          title="Delete workout"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <WorkoutDetailModal workout={openWorkout} onClose={() => setOpenId(null)} />
    </div>
  );
}

function WorkoutDetailModal({ workout, onClose }) {
  const videoId = workout?.video_url ? getYouTubeId(workout.video_url) : null;
  const [watched, setWatched] = useState(false);

  // Reset the "watched" indicator whenever a new workout is opened.
  useEffect(() => {
    setWatched(false);
  }, [workout?.id]);

  return (
    <Modal open={!!workout} onClose={onClose} title={workout?.title || ''} size="lg">
      {!workout ? null : (
        <>
          <div className="cluster">
            <span className="muted">For {workout.athlete_name || `user #${workout.athlete_id}`}</span>
            {workout.completed_at ? (
              <span
                className="badge"
                style={{
                  color: 'var(--success, #22c55e)',
                  borderColor: 'rgba(34,197,94,0.4)',
                }}
                title={`Completed ${new Date(workout.completed_at).toLocaleString()}`}
              >
                ✓ Completed {new Date(workout.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ) : null}
            {watched ? (
              <span
                className="badge"
                style={{
                  color: 'var(--success, #22c55e)',
                  borderColor: 'rgba(34,197,94,0.35)',
                }}
                title="You finished the tutorial video"
              >
                ✓ Tutorial watched
              </span>
            ) : null}
          </div>

          {workout.video_url ? (
            videoId ? (
              <YouTubePlayer
                videoId={videoId}
                onComplete={() => setWatched(true)}
              />
            ) : (
              <div className="video-fallback">
                <Icon name="message" size={20} />
                <span>Video URL didn't match a YouTube link.</span>
                <a
                  href={workout.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-link"
                >
                  Open in new tab
                </a>
              </div>
            )
          ) : null}

          {workout.description ? (
            <p style={{ margin: 0 }}>{workout.description}</p>
          ) : null}

          {workout.content ? (
            <div>
              <h3 className="section-title" style={{ marginBottom: 'var(--s-2)' }}>
                Session details
              </h3>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.92rem',
                  color: 'var(--text)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--s-4) var(--s-5)',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6,
                }}
              >
                {workout.content}
              </pre>
            </div>
          ) : (
            <p className="muted">No detailed session notes for this plan.</p>
          )}
        </>
      )}
    </Modal>
  );
}
