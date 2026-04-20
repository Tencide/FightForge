import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './pageLayout.css';

export default function Workouts() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content: '',
    athleteId: '',
  });
  const [saving, setSaving] = useState(false);

  const canManage = user.role === 'coach' || user.role === 'admin';

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

  async function createWorkout(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiFetch('/api/workouts', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description,
          content: form.content,
          athleteId: Number(form.athleteId),
        },
      });
      setForm({ title: '', description: '', content: '', athleteId: '' });
      const w = await apiFetch('/api/workouts');
      setItems(w);
    } catch (err) {
      setError(err.message || 'Could not create workout');
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
      if (expanded === id) setExpanded(null);
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">Workouts</h1>
      <p className="page-lead">
        {canManage
          ? 'Plans for athletes you work with. Create assignments below.'
          : 'Plans assigned to you by your coach or admin.'}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <form className="form" style={{ maxWidth: 520 }} onSubmit={createWorkout}>
          <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
            New workout
          </h2>
          <label className="label">
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
                  {a.full_name} (#{a.id})
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Title
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label className="label">
            Summary
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="label">
            Details (sets, rounds, notes)
            <textarea
              className="textarea"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create workout'}
          </button>
        </form>
      ) : null}

      <ul className="list">
        {items.length === 0 ? (
          <li className="muted">No workouts yet.</li>
        ) : (
          items.map((w) => (
            <li key={w.id} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{w.title}</strong>
                  <div className="muted" style={{ marginTop: '0.25rem' }}>
                    For {w.athlete_name || `user #${w.athlete_id}`}
                  </div>
                  {w.description ? <p style={{ margin: '0.5rem 0 0' }}>{w.description}</p> : null}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setExpanded(expanded === w.id ? null : w.id)}>
                    {expanded === w.id ? 'Hide' : 'Details'}
                  </button>
                  {canManage ? (
                    <button type="button" className="btn btn-danger" onClick={() => removeWorkout(w.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              {expanded === w.id && w.content ? (
                <pre
                  style={{
                    margin: '0.75rem 0 0',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.85rem',
                    color: '#c5cad6',
                  }}
                >
                  {w.content}
                </pre>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
