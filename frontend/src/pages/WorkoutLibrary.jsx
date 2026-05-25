import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import YouTubePlayer from '../components/YouTubePlayer';
import { getYouTubeId } from '../utils/youtube';
import './pageLayout.css';
import './WorkoutLibrary.css';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'striking', label: 'Striking' },
  { id: 'strength', label: 'Strength' },
  { id: 'grappling', label: 'Grappling' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'recovery', label: 'Recovery' },
];

const LEVEL_OPTIONS = [
  { id: 'all', label: 'Any level' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const GOAL_OPTIONS = [
  { id: 'all', label: 'Any goal' },
  { id: 'cut', label: 'Cut' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'bulk', label: 'Bulk' },
];

const SORT_OPTIONS = [
  { id: 'title', label: 'Title (A→Z)' },
  { id: 'titleDesc', label: 'Title (Z→A)' },
  { id: 'durationAsc', label: 'Duration (short → long)' },
  { id: 'durationDesc', label: 'Duration (long → short)' },
  { id: 'level', label: 'Level (easy → hard)' },
];

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

export default function WorkoutLibrary() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [goal, setGoal] = useState('all');
  const [sort, setSort] = useState('title');
  const [hasVideoOnly, setHasVideoOnly] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [adding, setAdding] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [pickerForId, setPickerForId] = useState(null);
  const [pickerAthleteId, setPickerAthleteId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [communityOnly, setCommunityOnly] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content: '',
    videoUrl: '',
    category: 'strength',
    experienceLevel: 'intermediate',
    durationMin: '60',
    goals: ['cut', 'maintain', 'bulk'],
  });

  const canManage = user.role === 'coach' || user.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await apiFetch('/api/workouts/library');
        if (!cancelled) setItems(lib);
        if (canManage) {
          const u = await apiFetch('/api/users');
          if (!cancelled) setAthletes(u.filter((x) => x.role === 'athlete'));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load library');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((w) => {
      if (category !== 'all' && w.category !== category) return false;
      if (level !== 'all' && w.experience_level !== level) return false;
      if (goal !== 'all') {
        const tags = String(w.goal_alignment || '').split(',').map((t) => t.trim());
        if (!tags.includes(goal)) return false;
      }
      if (hasVideoOnly && !w.video_url) return false;
      if (communityOnly && !w.created_by) return false;
      if (q) {
        const haystack = `${w.title} ${w.description || ''} ${w.content || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    switch (sort) {
      case 'titleDesc':
        list = [...list].sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'durationAsc':
        list = [...list].sort((a, b) => (a.duration_min || 0) - (b.duration_min || 0));
        break;
      case 'durationDesc':
        list = [...list].sort((a, b) => (b.duration_min || 0) - (a.duration_min || 0));
        break;
      case 'level':
        list = [...list].sort(
          (a, b) => (LEVEL_RANK[a.experience_level] ?? 9) - (LEVEL_RANK[b.experience_level] ?? 9)
        );
        break;
      case 'title':
      default:
        list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [items, search, category, level, goal, sort, hasVideoOnly, communityOnly]);

  function toggleGoal(goalId) {
    setForm((f) => {
      const has = f.goals.includes(goalId);
      const goals = has ? f.goals.filter((g) => g !== goalId) : [...f.goals, goalId];
      return { ...f, goals: goals.length ? goals : ['maintain'] };
    });
  }

  async function handleCreateLibrary(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      const created = await apiFetch('/api/workouts/library', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          content: form.content.trim(),
          videoUrl: form.videoUrl.trim(),
          category: form.category,
          experienceLevel: form.experienceLevel,
          durationMin: Number(form.durationMin) || 60,
          goalAlignment: form.goals.join(','),
        },
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
      setFeedback(`Added "${created.title}" to the library`);
      setShowAddForm(false);
      setForm({
        title: '',
        description: '',
        content: '',
        videoUrl: '',
        category: 'strength',
        experienceLevel: 'intermediate',
        durationMin: '60',
        goals: ['cut', 'maintain', 'bulk'],
      });
    } catch (err) {
      setError(err.message || 'Could not add to library');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLibrary(item) {
    if (!window.confirm(`Remove "${item.title}" from the library?`)) return;
    setDeletingId(item.id);
    setError('');
    try {
      await apiFetch(`/api/workouts/library/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((w) => w.id !== item.id));
      setFeedback(`Removed "${item.title}" from the library`);
      if (previewId === item.id) setPreviewId(null);
    } catch (err) {
      setError(err.message || 'Could not delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAdd(template, athleteId) {
    setAdding(template.id);
    setError('');
    setFeedback('');
    try {
      const body = athleteId ? { athleteId: Number(athleteId) } : {};
      const created = await apiFetch(`/api/workouts/library/${template.id}/copy`, {
        method: 'POST',
        body,
      });
      const targetName = created.athlete_name || 'your plans';
      setFeedback(`Added "${created.title}" to ${targetName}`);
      setPickerForId(null);
      setPickerAthleteId('');
    } catch (e) {
      setError(e.message || 'Could not add workout');
    } finally {
      setAdding(null);
    }
  }

  const previewItem = useMemo(
    () => items.find((w) => w.id === previewId) || null,
    [items, previewId]
  );

  return (
    <div className="stack fade-up">
      <header className="page-header with-actions">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="page-title">Workout templates</h1>
          <p className="page-lead">
            Browse official templates and community workouts. Add your own to share with everyone —
            they show as Made by your name.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
            <Icon name="plus" size={16} />
            Add to library
          </button>
          <Link to="/workouts" className="btn btn-subtle">
            <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} />
            Back to workouts
          </Link>
        </div>
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {feedback ? (
        <p
          className="success"
          role="status"
          style={{
            color: 'var(--success, #22c55e)',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
            padding: 'var(--s-3) var(--s-4)',
            borderRadius: 'var(--r-md)',
          }}
        >
          ✓ {feedback}
        </p>
      ) : null}

      <div className="lib-controls">
        <div className="lib-search">
          <input
            type="search"
            className="input"
            placeholder="Search title, description, content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="lib-filter-row">
          <label className="lib-filter">
            <span className="lib-filter-label">Category</span>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lib-filter">
            <span className="lib-filter-label">Level</span>
            <select
              className="select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lib-filter">
            <span className="lib-filter-label">Goal</span>
            <select className="select" value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOAL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lib-filter">
            <span className="lib-filter-label">Sort by</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lib-toggle">
            <input
              type="checkbox"
              checked={hasVideoOnly}
              onChange={(e) => setHasVideoOnly(e.target.checked)}
            />
            <span>With video only</span>
          </label>
          <label className="lib-toggle">
            <input
              type="checkbox"
              checked={communityOnly}
              onChange={(e) => setCommunityOnly(e.target.checked)}
            />
            <span>Community only</span>
          </label>
        </div>

        <div className="lib-meta">
          <span className="muted">
            {filtered.length} of {items.length} template{items.length === 1 ? '' : 's'}
          </span>
          {(search || category !== 'all' || level !== 'all' || goal !== 'all' || hasVideoOnly) && (
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setLevel('all');
                setGoal('all');
                setHasVideoOnly(false);
                setCommunityOnly(false);
              }}
            >
              <Icon name="x" size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="dumbbell" size={20} />
          </span>
          <h3>Loading library…</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="dumbbell" size={20} />
          </span>
          <h3>No matches</h3>
          <p>Try widening your filters or clearing the search.</p>
        </div>
      ) : (
        <ul className="lib-grid">
          {filtered.map((w) => (
            <li key={w.id} className="lib-card">
              <div className="lib-card-head">
                <div className={`lib-cat lib-cat-${w.category}`}>{w.category}</div>
                {w.video_url ? (
                  <span
                    className="badge"
                    style={{
                      color: 'var(--accent)',
                      borderColor: 'rgba(226,62,87,0.3)',
                    }}
                    title="Tutorial video included"
                  >
                    ▶ Video
                  </span>
                ) : null}
              </div>
              <h3 className="lib-title">{w.title}</h3>
              <p className="lib-made-by">
                {w.created_by_name ? (
                  <>
                    Made by: <strong>{w.created_by_name}</strong>
                  </>
                ) : (
                  <span className="muted">FightForge official</span>
                )}
              </p>
              {w.description ? <p className="lib-desc">{w.description}</p> : null}
              <div className="lib-tags">
                <span className="badge">{w.experience_level}</span>
                <span className="badge">{w.duration_min} min</span>
                {String(w.goal_alignment || '')
                  .split(',')
                  .filter(Boolean)
                  .map((g) => (
                    <span key={g.trim()} className="badge">
                      {g.trim()}
                    </span>
                  ))}
              </div>

              <div className="lib-card-actions">
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => setPreviewId(w.id)}
                >
                  Preview
                </button>
                {(w.created_by === user.id || user.role === 'admin') && w.created_by ? (
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    disabled={deletingId === w.id}
                    onClick={() => handleDeleteLibrary(w)}
                  >
                    {deletingId === w.id ? '…' : 'Remove'}
                  </button>
                ) : null}
                {pickerForId === w.id && canManage ? (
                  <div className="lib-picker">
                    <select
                      className="select"
                      value={pickerAthleteId}
                      onChange={(e) => setPickerAthleteId(e.target.value)}
                    >
                      <option value="">Add for me</option>
                      {athletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={adding === w.id}
                      onClick={() => handleAdd(w, pickerAthleteId || null)}
                    >
                      {adding === w.id ? 'Adding…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => {
                        setPickerForId(null);
                        setPickerAthleteId('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={adding === w.id}
                    onClick={() => {
                      if (canManage) {
                        setPickerForId(w.id);
                        setPickerAthleteId('');
                      } else {
                        handleAdd(w, null);
                      }
                    }}
                  >
                    <Icon name="plus" size={14} />
                    {adding === w.id ? 'Adding…' : 'Add to my plans'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <LibraryPreview
        item={previewItem}
        canManage={canManage}
        athletes={athletes}
        adding={adding === previewItem?.id}
        onClose={() => setPreviewId(null)}
        onAdd={(athleteId) => handleAdd(previewItem, athleteId)}
      />

      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add workout to library" size="md">
        <form className="stack lib-add-form" onSubmit={handleCreateLibrary}>
          <label className="label">
            Title *
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              maxLength={200}
            />
          </label>
          <label className="label">
            Short description
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is this session for?"
            />
          </label>
          <label className="label">
            Workout details
            <textarea
              className="input"
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Warm-up, rounds, drills, cooldown…"
            />
          </label>
          <label className="label">
            YouTube URL (optional)
            <input
              className="input"
              type="url"
              value={form.videoUrl}
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
              placeholder="https://youtube.com/…"
            />
          </label>
          <div className="lib-form-row">
            <label className="label">
              Category
              <select
                className="select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Level
              <select
                className="select"
                value={form.experienceLevel}
                onChange={(e) => setForm((f) => ({ ...f, experienceLevel: e.target.value }))}
              >
                {LEVEL_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Duration (min)
              <input
                className="input"
                type="number"
                min={5}
                max={300}
                value={form.durationMin}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
              />
            </label>
          </div>
          <fieldset className="lib-goals-field">
            <legend className="lib-filter-label">Goals</legend>
            <div className="lib-goals-row">
              {GOAL_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
                <label key={o.id} className="lib-toggle">
                  <input
                    type="checkbox"
                    checked={form.goals.includes(o.id)}
                    onChange={() => toggleGoal(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            This will appear in the library as <strong>Made by: {user.full_name}</strong>.
          </p>
          <div className="lib-form-actions">
            <button type="button" className="btn btn-subtle" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Publish to library'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function LibraryPreview({ item, canManage, athletes, adding, onClose, onAdd }) {
  const [chosenAthlete, setChosenAthlete] = useState('');
  useEffect(() => {
    setChosenAthlete('');
  }, [item?.id]);

  const videoId = item?.video_url ? getYouTubeId(item.video_url) : null;

  return (
    <Modal open={!!item} onClose={onClose} title={item?.title || ''} size="lg">
      {!item ? null : (
        <>
          <p className="lib-made-by">
            {item.created_by_name ? (
              <>
                Made by: <strong>{item.created_by_name}</strong>
              </>
            ) : (
              <span className="muted">FightForge official</span>
            )}
          </p>
          <div className="cluster">
            <span className={`badge`}>{item.category}</span>
            <span className="badge">{item.experience_level}</span>
            <span className="badge">{item.duration_min} min</span>
            {String(item.goal_alignment || '')
              .split(',')
              .filter(Boolean)
              .map((g) => (
                <span key={g.trim()} className="badge">
                  {g.trim()}
                </span>
              ))}
          </div>

          {videoId ? (
            <YouTubePlayer videoId={videoId} />
          ) : item.video_url ? (
            <a
              className="btn-link"
              href={item.video_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open video link
            </a>
          ) : null}

          {item.description ? <p style={{ margin: 0 }}>{item.description}</p> : null}

          {item.content ? (
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
                {item.content}
              </pre>
            </div>
          ) : null}

          <div className="cluster" style={{ marginTop: 'var(--s-3)' }}>
            {canManage && athletes.length > 0 ? (
              <select
                className="select"
                value={chosenAthlete}
                onChange={(e) => setChosenAthlete(e.target.value)}
                style={{ flex: '1 1 200px' }}
              >
                <option value="">Add for me</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    Add for {a.full_name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={adding}
              onClick={() => onAdd(chosenAthlete || null)}
            >
              <Icon name="plus" size={16} />
              {adding ? 'Adding…' : 'Add to my plans'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
