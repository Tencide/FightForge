import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { SHOW_DEMO_ACCOUNTS } from '../config';
import './pageLayout.css';
import './Home.css';

const FEATURES = [
  {
    icon: 'dumbbell',
    title: 'Coach-built workouts',
    body: 'Strength, conditioning, and skill sessions assigned by your coach — synced from the database.',
  },
  {
    icon: 'apple',
    title: 'Nutrition that scales',
    body: 'Daily macro and calorie targets aligned with your weight class and training cycle.',
  },
  {
    icon: 'trending',
    title: 'Track every metric',
    body: 'Log weight, body comp, lifts, and cardio. See trendlines, not just numbers.',
  },
  {
    icon: 'message',
    title: 'Direct line to your coach',
    body: 'Built-in messaging — questions and form checks without leaving the platform.',
  },
];

const STATS = [
  { value: '3', label: 'Roles', sub: 'Athlete · Coach · Admin' },
  { value: '5', label: 'Modules', sub: 'Workouts · Meals · Progress · Chat · Users' },
  { value: 'JWT', label: 'Auth', sub: 'Token-based, role-aware' },
];

function postLoginPath(role) {
  if (role === 'athlete') return '/dashboard';
  if (role === 'coach') return '/coach';
  if (role === 'admin') return '/admin';
  return '/';
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="home">
      <section className="home-hero fade-up">
        <p className="eyebrow">FightForge</p>
        <h1 className="home-title">
          Train. Track.{' '}
          <span className="home-title-accent">
            Dominate
            <svg
              className="home-title-stroke"
              viewBox="0 0 220 14"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M2 8 Q 60 2 120 6 T 218 5"
                stroke="url(#hg)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="220" y2="0">
                  <stop offset="0%" stopColor="#ffd478" />
                  <stop offset="100%" stopColor="#e23e57" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          .
        </h1>
        <p className="home-lead">
          MMA training, nutrition, and progress tracking built for athletes and the coaches who push
          them. A class-built full-stack platform — React, Node, MySQL — wired end-to-end.
        </p>

        <div className="cluster" style={{ marginTop: 'var(--s-3)' }}>
          {!isAuthenticated ? (
            <>
              <Link className="btn btn-primary" to="/login">
                Log in
                <Icon name="arrowRight" size={16} />
              </Link>
              <Link className="btn btn-ghost" to="/signup">
                Create account
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to={postLoginPath(user?.role)}>
                Open the app
                <Icon name="arrowRight" size={16} />
              </Link>
              <span className="muted">
                Signed in as <strong>{user?.full_name}</strong>
              </span>
            </>
          )}
        </div>

        <ul className="home-stats">
          {STATS.map((s) => (
            <li key={s.label}>
              <span className="home-stat-value">{s.value}</span>
              <span className="home-stat-label">{s.label}</span>
              <span className="home-stat-sub">{s.sub}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-features">
        <div className="spread">
          <h2 className="page-title" style={{ fontSize: '1.4rem' }}>
            Everything you need to run a fight camp
          </h2>
          <span className="muted">Open source · train smarter, cut cleaner, stay connected</span>
        </div>
        <div className="card-grid-md" style={{ marginTop: 'var(--s-4)' }}>
          {FEATURES.map((f) => (
            <article className="card home-feature" key={f.title}>
              <div className="home-feature-icon">
                <Icon name={f.icon} size={20} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta card">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>
            {SHOW_DEMO_ACCOUNTS ? 'Try sample accounts (local only)' : 'Ready to start training?'}
          </h2>
          <p className="muted" style={{ marginTop: 'var(--s-1)' }}>
            {SHOW_DEMO_ACCOUNTS ? (
              <>
                Password <span className="mono">Password123!</span> on{' '}
                <span className="mono">athlete@fightforge.test</span>,{' '}
                <span className="mono">coach@fightforge.test</span>, or{' '}
                <span className="mono">admin@fightforge.test</span>.
              </>
            ) : (
              <>
                Create a free account and start tracking workouts, meals, and progress today.
                Friends, leaderboards, and a curated MMA workout library are all included.
              </>
            )}
          </p>
        </div>
        {!isAuthenticated ? (
          <Link to={SHOW_DEMO_ACCOUNTS ? '/login' : '/signup'} className="btn btn-subtle">
            {SHOW_DEMO_ACCOUNTS ? 'Take the tour' : 'Create account'}
            <Icon name="chevronRight" size={16} />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
