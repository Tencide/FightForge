import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import { resizeImageToSquareDataUrl } from '../utils/image';
import './pageLayout.css';
import './Profile.css';

const EMPTY_GOALS = {
  sex: '',
  ageYears: '',
  heightIn: '',
  currentWeightLb: '',
  targetWeightLb: '',
  goalType: 'maintain',
  daysPerWeek: 4,
  experienceLevel: 'intermediate',
  trainingFocus: 'all-around',
  dietary: 'none',
  weightClass: '',
};

function mergeGoals(profile) {
  return { ...EMPTY_GOALS, ...(profile || {}) };
}

// Local Initials helper removed; we now use the shared <Avatar /> component
// that displays the user's uploaded photo (or initials fallback).

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function tdeeEstimate(g) {
  const sex = g.sex || 'male';
  const age = Number(g.ageYears) || 25;
  const heightIn = Number(g.heightIn) || 68;
  const weightLb = Number(g.currentWeightLb) || 170;
  const days = Math.max(0, Math.min(7, Number(g.daysPerWeek) || 4));
  const heightCm = heightIn * 2.54;
  const weightKg = weightLb * 0.453592;
  const sexAdj = sex === 'female' ? -161 : sex === 'other' ? -78 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdj;
  const factor = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9][days];
  const tdee = bmr * factor;
  let target = tdee;
  if (g.goalType === 'cut') target = tdee - 500;
  else if (g.goalType === 'bulk') target = tdee + 350;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    canEstimate: g.sex && g.ageYears && g.heightIn && g.currentWeightLb,
  };
}

export default function Profile() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [identity, setIdentity] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    password: '',
    confirm: '',
  });
  const [goals, setGoals] = useState(() => mergeGoals(user?.profile));
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [generatingWorkout, setGeneratingWorkout] = useState(false);
  const [generatingMeal, setGeneratingMeal] = useState(false);
  const [identityMsg, setIdentityMsg] = useState(null);
  const [goalsMsg, setGoalsMsg] = useState(null);
  const [genMsg, setGenMsg] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);
  const fileInputRef = useRef(null);

  async function handleAvatarFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAvatarMsg(null);
    setAvatarSaving(true);
    try {
      const dataUrl = await resizeImageToSquareDataUrl(file, { size: 256, quality: 0.85 });
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: { avatarUrl: dataUrl },
      });
      await refreshProfile();
      setAvatarMsg({ type: 'success', text: 'Profile photo updated.' });
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.message || 'Could not upload photo' });
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    setAvatarMsg(null);
    setAvatarSaving(true);
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: { avatarUrl: null },
      });
      await refreshProfile();
      setAvatarMsg({ type: 'success', text: 'Photo removed.' });
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.message || 'Could not remove photo' });
    } finally {
      setAvatarSaving(false);
    }
  }

  useEffect(() => {
    refreshProfile().catch(() => {});
    // Pull latest server-side state on mount only — refreshProfile changes
    // identity when user updates, so depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGoals(mergeGoals(user?.profile));
    setIdentity((prev) => ({
      ...prev,
      fullName: user?.full_name || prev.fullName,
      email: user?.email || prev.email,
    }));
  }, [user?.profile, user?.full_name, user?.email]);

  const profileComplete = useMemo(() => {
    return Boolean(goals.sex && goals.ageYears && goals.heightIn && goals.currentWeightLb && goals.goalType);
  }, [goals]);

  const tdee = useMemo(() => tdeeEstimate(goals), [goals]);

  async function saveIdentity(e) {
    e.preventDefault();
    setIdentityMsg(null);
    if (identity.password && identity.password !== identity.confirm) {
      setIdentityMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (identity.password && identity.password.length < 6) {
      setIdentityMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setSavingIdentity(true);
    try {
      const body = {
        fullName: identity.fullName.trim(),
        email: identity.email.trim(),
      };
      if (identity.password) body.password = identity.password;
      await apiFetch(`/api/users/${user.id}`, { method: 'PUT', body });
      setIdentity((p) => ({ ...p, password: '', confirm: '' }));
      await refreshProfile();
      setIdentityMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setIdentityMsg({ type: 'error', text: err.message || 'Could not update profile' });
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveGoals(e) {
    e.preventDefault();
    setGoalsMsg(null);
    setSavingGoals(true);
    try {
      const cleaned = {};
      for (const [k, v] of Object.entries(goals)) {
        if (v === '' || v == null) continue;
        if (['ageYears', 'heightIn', 'currentWeightLb', 'targetWeightLb', 'daysPerWeek'].includes(k)) {
          const n = Number(v);
          if (!Number.isNaN(n)) cleaned[k] = n;
        } else {
          cleaned[k] = v;
        }
      }
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: { profile: cleaned },
      });
      await refreshProfile();
      setGoalsMsg({ type: 'success', text: 'Goals saved.' });
    } catch (err) {
      setGoalsMsg({ type: 'error', text: err.message || 'Could not save goals' });
    } finally {
      setSavingGoals(false);
    }
  }

  async function generateWorkout() {
    setGenMsg(null);
    setGeneratingWorkout(true);
    try {
      const w = await apiFetch('/api/workouts/generate', { method: 'POST' });
      setGenMsg({
        type: 'success',
        text: `Workout plan "${w.title}" created.`,
        link: '/workouts',
        linkText: 'View workouts',
      });
    } catch (err) {
      setGenMsg({ type: 'error', text: err.message || 'Could not generate workout' });
    } finally {
      setGeneratingWorkout(false);
    }
  }

  async function generateMeal() {
    setGenMsg(null);
    setGeneratingMeal(true);
    try {
      const m = await apiFetch('/api/meals/generate', { method: 'POST' });
      setGenMsg({
        type: 'success',
        text: `Meal plan "${m.title}" created (${m.target_calories} kcal target).`,
        link: '/meals',
        linkText: 'View meal plans',
      });
    } catch (err) {
      setGenMsg({ type: 'error', text: err.message || 'Could not generate meal plan' });
    } finally {
      setGeneratingMeal(false);
    }
  }

  const roleBadgeClass =
    user?.role === 'coach' ? 'badge-coach' : user?.role === 'admin' ? 'badge-admin' : 'badge-athlete';

  return (
    <div className="stack fade-up">
      <header className="page-header">
        <p className="eyebrow">Profile</p>
        <h1 className="page-title">Your account &amp; goals</h1>
        <p className="page-lead">
          Update your details, set your training goals, and let FightForge build a personalized
          workout and meal plan.
        </p>
      </header>

      <section className="profile-hero">
        <div className="profile-avatar-wrap">
          <Avatar user={user} size={88} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleAvatarFile}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cluster" style={{ marginBottom: 4 }}>
            <h2 className="section-title" style={{ fontSize: '1.15rem' }}>
              {user?.full_name}
            </h2>
            <span className={`badge ${roleBadgeClass}`}>{user?.role}</span>
          </div>
          <div className="muted">{user?.email}</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Member since {fmtDate(user?.created_at)}
          </div>
          <div className="cluster" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarSaving}
            >
              {avatarSaving
                ? 'Saving…'
                : user?.avatar_url
                ? 'Change photo'
                : 'Upload photo'}
            </button>
            {user?.avatar_url && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={removeAvatar}
                disabled={avatarSaving}
              >
                Remove
              </button>
            )}
          </div>
          {avatarMsg && (
            <p
              className={avatarMsg.type === 'error' ? 'error' : 'success'}
              style={{ marginTop: 8 }}
            >
              {avatarMsg.text}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-subtle btn-sm" onClick={() => { logout(); navigate('/'); }}>
          Log out
        </button>
      </section>

      <div className="profile-grid">
        {/* IDENTITY CARD */}
        <form className="form-card stack" onSubmit={saveIdentity}>
          <div className="spread">
            <h2 className="section-title">Account details</h2>
          </div>

          <label className="label">
            Full name
            <input
              className="input"
              value={identity.fullName}
              onChange={(e) => setIdentity((p) => ({ ...p, fullName: e.target.value }))}
              required
              minLength={2}
            />
          </label>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={identity.email}
              onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </label>

          <div className="divider" />

          <h3 className="muted" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Change password (optional)
          </h3>
          <label className="label">
            New password
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              value={identity.password}
              onChange={(e) => setIdentity((p) => ({ ...p, password: e.target.value }))}
            />
          </label>
          <label className="label">
            Confirm new password
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={identity.confirm}
              onChange={(e) => setIdentity((p) => ({ ...p, confirm: e.target.value }))}
            />
          </label>

          {identityMsg ? (
            <p className={identityMsg.type === 'success' ? 'success' : 'error'} role="alert">
              {identityMsg.text}
            </p>
          ) : null}

          <div className="cluster">
            <button className="btn btn-primary" type="submit" disabled={savingIdentity}>
              {savingIdentity ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        {/* GOALS CARD */}
        <form className="form-card stack" onSubmit={saveGoals}>
          <div className="spread">
            <h2 className="section-title">Training goals</h2>
            {profileComplete ? (
              <span className="badge badge-athlete">Ready to generate</span>
            ) : (
              <span className="badge">Incomplete</span>
            )}
          </div>

          <div className="row">
            <label className="label" style={{ flex: '1 1 140px' }}>
              Sex
              <select
                className="select"
                value={goals.sex}
                onChange={(e) => setGoals((g) => ({ ...g, sex: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="label" style={{ flex: '1 1 100px' }}>
              Age
              <input
                className="input"
                type="number"
                min={14}
                max={90}
                value={goals.ageYears}
                onChange={(e) => setGoals((g) => ({ ...g, ageYears: e.target.value }))}
                required
              />
            </label>
            <label className="label" style={{ flex: '1 1 120px' }}>
              Height (in)
              <input
                className="input"
                type="number"
                min={48}
                max={84}
                step="0.5"
                value={goals.heightIn}
                onChange={(e) => setGoals((g) => ({ ...g, heightIn: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="row">
            <label className="label" style={{ flex: '1 1 140px' }}>
              Current weight (lb)
              <input
                className="input"
                type="number"
                step="0.1"
                value={goals.currentWeightLb}
                onChange={(e) => setGoals((g) => ({ ...g, currentWeightLb: e.target.value }))}
                required
              />
            </label>
            <label className="label" style={{ flex: '1 1 140px' }}>
              Target weight (lb)
              <input
                className="input"
                type="number"
                step="0.1"
                placeholder="optional"
                value={goals.targetWeightLb}
                onChange={(e) => setGoals((g) => ({ ...g, targetWeightLb: e.target.value }))}
              />
            </label>
            <label className="label" style={{ flex: '1 1 160px' }}>
              Weight class
              <input
                className="input"
                placeholder="e.g. Lightweight"
                value={goals.weightClass}
                onChange={(e) => setGoals((g) => ({ ...g, weightClass: e.target.value }))}
              />
            </label>
          </div>

          <div className="row">
            <label className="label" style={{ flex: '1 1 160px' }}>
              Phase
              <select
                className="select"
                value={goals.goalType}
                onChange={(e) => setGoals((g) => ({ ...g, goalType: e.target.value }))}
              >
                <option value="cut">Cut (lose fat)</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk (gain mass)</option>
              </select>
            </label>
            <label className="label" style={{ flex: '1 1 140px' }}>
              Days/week
              <input
                className="input"
                type="number"
                min={2}
                max={7}
                value={goals.daysPerWeek}
                onChange={(e) => setGoals((g) => ({ ...g, daysPerWeek: e.target.value }))}
              />
            </label>
            <label className="label" style={{ flex: '1 1 160px' }}>
              Experience
              <select
                className="select"
                value={goals.experienceLevel}
                onChange={(e) => setGoals((g) => ({ ...g, experienceLevel: e.target.value }))}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>

          <div className="row">
            <label className="label" style={{ flex: '1 1 200px' }}>
              Training focus
              <select
                className="select"
                value={goals.trainingFocus}
                onChange={(e) => setGoals((g) => ({ ...g, trainingFocus: e.target.value }))}
              >
                <option value="all-around">All-around MMA</option>
                <option value="striking">Striking</option>
                <option value="grappling">Grappling</option>
                <option value="strength">Strength &amp; conditioning</option>
              </select>
            </label>
            <label className="label" style={{ flex: '1 1 200px' }}>
              Dietary preference
              <select
                className="select"
                value={goals.dietary}
                onChange={(e) => setGoals((g) => ({ ...g, dietary: e.target.value }))}
              >
                <option value="none">No restriction</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="halal">Halal</option>
                <option value="kosher">Kosher</option>
              </select>
            </label>
          </div>

          {tdee.canEstimate ? (
            <div className="profile-estimate">
              <span>BMR <strong>{tdee.bmr}</strong></span>
              <span>TDEE <strong>{tdee.tdee}</strong></span>
              <span>
                Target{' '}
                <strong style={{ color: 'var(--brand)' }}>{tdee.target} kcal</strong>
              </span>
            </div>
          ) : null}

          {goalsMsg ? (
            <p className={goalsMsg.type === 'success' ? 'success' : 'error'} role="alert">
              {goalsMsg.text}
            </p>
          ) : null}

          <div className="cluster">
            <button className="btn btn-primary" type="submit" disabled={savingGoals}>
              {savingGoals ? 'Saving…' : 'Save goals'}
            </button>
          </div>
        </form>
      </div>

      {/* GENERATORS */}
      <section className="card stack">
        <div className="spread">
          <div>
            <h2 className="section-title">Auto-generate plans</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              Build a workout and a meal plan tailored to the goals above. They show up in your
              normal Workouts and Meals tabs.
            </p>
          </div>
        </div>

        {!profileComplete ? (
          <div className="empty" style={{ padding: 'var(--s-5)' }}>
            <span className="empty-icon">
              <Icon name="notebook" size={20} />
            </span>
            <h3>Fill in your goals first</h3>
            <p>
              Sex, age, height, current weight, and phase are required. Save your goals above and
              the buttons will unlock.
            </p>
          </div>
        ) : (
          <div className="profile-generate">
            <div className="card profile-gen-tile">
              <div className="profile-gen-icon" style={{ color: 'var(--brand)' }}>
                <Icon name="dumbbell" size={22} />
              </div>
              <h3 className="section-title">Workout plan</h3>
              <p className="muted">
                7-day schedule with sessions tailored to your phase, focus, and experience level.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={generateWorkout}
                disabled={generatingWorkout}
              >
                <Icon name="plus" size={14} />
                {generatingWorkout ? 'Generating…' : 'Generate workout'}
              </button>
            </div>

            <div className="card profile-gen-tile">
              <div className="profile-gen-icon" style={{ color: '#38bdf8' }}>
                <Icon name="apple" size={22} />
              </div>
              <h3 className="section-title">Meal plan</h3>
              <p className="muted">
                Target calories + macros (protein/carbs/fat) calculated from BMR and your phase.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={generateMeal}
                disabled={generatingMeal}
              >
                <Icon name="plus" size={14} />
                {generatingMeal ? 'Generating…' : 'Generate meal plan'}
              </button>
            </div>
          </div>
        )}

        {genMsg ? (
          <div className={genMsg.type === 'success' ? 'success' : 'error'} role="alert">
            <div className="spread" style={{ alignItems: 'center' }}>
              <span>{genMsg.text}</span>
              {genMsg.link ? (
                <Link to={genMsg.link} className="btn-link">
                  {genMsg.linkText} →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
