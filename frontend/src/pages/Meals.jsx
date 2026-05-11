import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import './pageLayout.css';

const EMPTY_FORM = {
  title: '',
  description: '',
  athleteId: '',
  targetCalories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  notes: '',
};

function macroPct(p) {
  const cal = Number(p.target_calories) || 0;
  const protein = Number(p.protein_g) || 0;
  const carbs = Number(p.carbs_g) || 0;
  const fat = Number(p.fat_g) || 0;
  if (!cal || !(protein + carbs + fat)) return null;
  const pCal = protein * 4;
  const cCal = carbs * 4;
  const fCal = fat * 9;
  const total = pCal + cCal + fCal || 1;
  return {
    p: Math.round((pCal / total) * 100),
    c: Math.round((cCal / total) * 100),
    f: Math.round((fCal / total) * 100),
    pCal,
    cCal,
    fCal,
  };
}

export default function Meals() {
  const { user, refreshProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [xpToast, setXpToast] = useState(null);

  const canManage = user.role === 'coach' || user.role === 'admin';
  const isAthlete = user.role === 'athlete';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await apiFetch('/api/meals');
        if (!cancelled) setItems(m);
        if (canManage) {
          const u = await apiFetch('/api/users');
          if (!cancelled) setUsers(u.filter((x) => x.role === 'athlete'));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load meals');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  async function createMeal(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiFetch('/api/meals', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description,
          athleteId: Number(form.athleteId),
          targetCalories: form.targetCalories || null,
          proteinG: form.proteinG || null,
          carbsG: form.carbsG || null,
          fatG: form.fatG || null,
          notes: form.notes || null,
        },
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      const m = await apiFetch('/api/meals');
      setItems(m);
    } catch (err) {
      setError(err.message || 'Could not create meal plan');
    } finally {
      setSaving(false);
    }
  }

  async function removeMeal(id) {
    if (!window.confirm('Delete this meal plan?')) return;
    try {
      await apiFetch(`/api/meals/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  }

  async function generateToday() {
    setError('');
    setGenerating(true);
    try {
      const created = await apiFetch('/api/meals/generate-today', { method: 'POST' });
      setItems((prev) => [created, ...prev]);
    } catch (err) {
      setError(err.message || 'Could not generate today\u2019s meal plan');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleComplete(m) {
    const completed = !m.completed_at;
    setCompletingId(m.id);
    setError('');
    try {
      const updated = await apiFetch(`/api/meals/${m.id}/complete`, {
        method: 'POST',
        body: { completed },
      });
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...updated } : x)));
      if (updated.xp && updated.xp.delta && user.role === 'athlete') {
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

  const grouped = useMemo(() => {
    if (!canManage) return { _: items };
    const out = {};
    for (const m of items) {
      const k = m.athlete_name || `User #${m.athlete_id}`;
      out[k] = out[k] || [];
      out[k].push(m);
    }
    return out;
  }, [items, canManage]);

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
          <p className="eyebrow">Nutrition</p>
          <h1 className="page-title">Meal plans</h1>
          <p className="page-lead">
            {canManage
              ? 'Build calorie and macro targets for your athletes by training cycle.'
              : 'Daily nutrition targets assigned to you. Hit your numbers, win your camp.'}
          </p>
        </div>
        <div className="cluster">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={generateToday}
            disabled={generating}
            title={
              isAthlete
                ? 'Auto-create today\u2019s meals from the library, scaled to your goal weight'
                : 'Auto-create today\u2019s meals for yourself from the library'
            }
          >
            <Icon name="apple" size={16} />
            {generating ? 'Generating\u2026' : 'Generate today\u2019s meals'}
          </button>
          {canManage ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm((v) => !v)}
            >
              <Icon name={showForm ? 'x' : 'plus'} size={16} />
              {showForm ? 'Cancel' : 'New plan'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {canManage && showForm ? (
        <form className="form-card fade-up" onSubmit={createMeal}>
          <h2 className="section-title">New meal plan</h2>
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
                {users.map((a) => (
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
                placeholder="e.g. Fight week — cut"
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
          <div className="row">
            <label className="label" style={{ flex: '1 1 130px' }}>
              Calories
              <input
                className="input"
                type="number"
                placeholder="2400"
                value={form.targetCalories}
                onChange={(e) => setForm((f) => ({ ...f, targetCalories: e.target.value }))}
              />
            </label>
            <label className="label" style={{ flex: '1 1 130px' }}>
              Protein (g)
              <input
                className="input"
                type="number"
                placeholder="220"
                value={form.proteinG}
                onChange={(e) => setForm((f) => ({ ...f, proteinG: e.target.value }))}
              />
            </label>
            <label className="label" style={{ flex: '1 1 130px' }}>
              Carbs (g)
              <input
                className="input"
                type="number"
                placeholder="240"
                value={form.carbsG}
                onChange={(e) => setForm((f) => ({ ...f, carbsG: e.target.value }))}
              />
            </label>
            <label className="label" style={{ flex: '1 1 130px' }}>
              Fat (g)
              <input
                className="input"
                type="number"
                placeholder="70"
                value={form.fatG}
                onChange={(e) => setForm((f) => ({ ...f, fatG: e.target.value }))}
              />
            </label>
          </div>
          <label className="label">
            Notes
            <textarea
              className="textarea"
              placeholder="Carb cycling, hydration, food choices…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="cluster">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create plan'}
            </button>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => {
                setForm(EMPTY_FORM);
                setShowForm(false);
              }}
            >
              Discard
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="apple" size={20} />
          </span>
          <h3>No meal plans yet</h3>
          <p>
            {canManage
              ? 'Build your first meal plan above to set athlete macros.'
              : 'Your coach will assign nutrition targets here.'}
          </p>
        </div>
      ) : (
        <div className="stack">
          {Object.values(grouped).flat().map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              canManage={canManage}
              canComplete={
                canManage || (isAthlete && m.athlete_id === user.id)
              }
              completing={completingId === m.id}
              onToggleComplete={() => toggleComplete(m)}
              onDelete={() => removeMeal(m.id)}
              showAthlete={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatCompletedDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MealCard({
  meal,
  canManage,
  canComplete,
  completing,
  onToggleComplete,
  onDelete,
  showAthlete,
}) {
  const macros = macroPct(meal);
  const done = !!meal.completed_at;
  return (
    <article
      className="list-item"
      style={
        done
          ? {
              borderColor: 'rgba(34,197,94,0.4)',
              background:
                'linear-gradient(180deg, rgba(34,197,94,0.05) 0%, transparent 100%)',
            }
          : undefined
      }
    >
      <div className="spread">
        <div style={{ minWidth: 0, flex: 1 }}>
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
              {meal.title}
            </strong>
            {done ? (
              <span
                className="badge"
                style={{
                  color: 'var(--success, #22c55e)',
                  borderColor: 'rgba(34,197,94,0.4)',
                }}
                title={`Completed ${new Date(meal.completed_at).toLocaleString()}`}
              >
                ✓ Done {formatCompletedDate(meal.completed_at)}
              </span>
            ) : null}
          </div>
          {showAthlete ? (
            <div className="muted" style={{ marginTop: 4 }}>
              For {meal.athlete_name || `user #${meal.athlete_id}`}
            </div>
          ) : null}
          {meal.description ? (
            <p style={{ margin: '0.5rem 0 0' }}>{meal.description}</p>
          ) : null}
        </div>
        <div className="cluster">
          {canComplete ? (
            <button
              type="button"
              className={done ? 'btn btn-subtle btn-sm' : 'btn btn-primary btn-sm'}
              onClick={onToggleComplete}
              disabled={completing}
              title={done ? 'Mark as not done' : 'Mark as completed'}
            >
              <Icon name={done ? 'x' : 'check'} size={14} />
              {completing ? 'Saving\u2026' : done ? 'Undo' : 'Mark done'}
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              title="Delete meal plan"
            >
              <Icon name="trash" size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-3)' }}>
        {meal.target_calories != null && <span className="badge">{meal.target_calories} kcal</span>}
        {meal.protein_g != null && <span className="badge">P {meal.protein_g}g</span>}
        {meal.carbs_g != null && <span className="badge">C {meal.carbs_g}g</span>}
        {meal.fat_g != null && <span className="badge">F {meal.fat_g}g</span>}
      </div>

      {macros ? (
        <div
          style={{
            display: 'flex',
            height: 8,
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 'var(--s-3)',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
          }}
          aria-label="Macro distribution"
        >
          <div title={`Protein ${macros.p}%`} style={{ width: `${macros.p}%`, background: '#f4b942' }} />
          <div title={`Carbs ${macros.c}%`} style={{ width: `${macros.c}%`, background: '#38bdf8' }} />
          <div title={`Fat ${macros.f}%`} style={{ width: `${macros.f}%`, background: '#a78bfa' }} />
        </div>
      ) : null}

      {meal.notes ? (
        <pre
          className="muted"
          style={{
            margin: 'var(--s-3) 0 0',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.6,
            fontSize: '0.92rem',
          }}
        >
          {meal.notes}
        </pre>
      ) : null}
    </article>
  );
}
