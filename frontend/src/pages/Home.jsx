import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './pageLayout.css';

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <p style={{ color: '#f4b942', fontWeight: 700, letterSpacing: '0.12em', margin: 0 }}>
        FIGHTFORGE
      </p>
      <h1 className="page-title" style={{ fontSize: '2rem' }}>
        MMA training and nutrition, in one place
      </h1>
      <p className="page-lead">
        Structured workouts, meal planning, performance tracking, and coach messaging — built as a
        full-stack class project with React, Node.js, and MySQL.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {!isAuthenticated ? (
          <>
            <Link className="btn btn-primary" to="/login">
              Log in
            </Link>
            <Link className="btn btn-ghost" to="/signup">
              Sign up
            </Link>
          </>
        ) : (
          <Link
            className="btn btn-primary"
            to={user?.role === 'athlete' ? '/dashboard' : user?.role === 'coach' ? '/workouts' : '/admin'}
          >
            Go to app
          </Link>
        )}
      </div>

      <div className="card-grid" style={{ marginTop: '1.5rem' }}>
        <div className="card" style={{ cursor: 'default' }}>
          <h3>Training</h3>
          <p>Workout plans assigned by your coach and tracked from the database.</p>
        </div>
        <div className="card" style={{ cursor: 'default' }}>
          <h3>Nutrition</h3>
          <p>Meal targets aligned with your goals (team member UI).</p>
        </div>
        <div className="card" style={{ cursor: 'default' }}>
          <h3>Progress</h3>
          <p>Log strength, conditioning, and body metrics over time.</p>
        </div>
      </div>
    </div>
  );
}
