import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './pageLayout.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, p] = await Promise.all([
          apiFetch('/api/workouts'),
          apiFetch(`/api/progress/${user.id}`),
        ]);
        if (!cancelled) {
          setWorkouts(w);
          setProgress(p);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const latest = progress[0];

  return (
    <div className="stack">
      <h1 className="page-title">Welcome back, {user.full_name}</h1>
      <p className="page-lead">Your training hub — open workouts, log progress, and keep in touch with your coach.</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card-grid">
        <Link className="card" to="/workouts">
          <h3>Workouts</h3>
          <p>{workouts.length} plan{workouts.length === 1 ? '' : 's'} assigned</p>
        </Link>
        <Link className="card" to="/meals">
          <h3>Meal plans</h3>
          <p>View nutrition targets (teammate page).</p>
        </Link>
        <Link className="card" to="/progress">
          <h3>Progress</h3>
          <p>{progress.length} entr{progress.length === 1 ? 'y' : 'ies'} logged</p>
        </Link>
        <Link className="card" to="/chat">
          <h3>Chat</h3>
          <p>Message your coach (teammate page).</p>
        </Link>
      </div>

      {latest ? (
        <section className="list-item" style={{ marginTop: '0.5rem' }}>
          <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
            Latest check-in
          </h2>
          <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
            {latest.recorded_at?.slice?.(0, 10) || latest.recorded_at}
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {latest.weight_lb != null && <li>Weight: {latest.weight_lb} lb</li>}
            {latest.bench_press_lb != null && <li>Bench: {latest.bench_press_lb} lb</li>}
            {latest.squat_lb != null && <li>Squat: {latest.squat_lb} lb</li>}
            {latest.cardio_minutes != null && <li>Cardio: {latest.cardio_minutes} min</li>}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
