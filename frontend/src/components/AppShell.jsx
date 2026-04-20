import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AppShell.module.css';

export function AppShell() {
  const { user, logout } = useAuth();
  const isAthlete = user?.role === 'athlete';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to={isAthlete ? '/dashboard' : '/'} className={styles.brand}>
          FightForge
        </Link>
        <nav className={styles.nav}>
          {isAthlete && (
            <>
              <NavLink to="/dashboard" className={styles.navLink}>
                Dashboard
              </NavLink>
              <NavLink to="/workouts" className={styles.navLink}>
                Workouts
              </NavLink>
              <NavLink to="/progress" className={styles.navLink}>
                Progress
              </NavLink>
              <NavLink to="/meals" className={styles.navLink}>
                Meals
              </NavLink>
              <NavLink to="/chat" className={styles.navLink}>
                Chat
              </NavLink>
            </>
          )}
          {(user?.role === 'coach' || user?.role === 'admin') && (
            <>
              <NavLink to="/workouts" className={styles.navLink}>
                Workouts
              </NavLink>
              <NavLink to="/progress" className={styles.navLink}>
                Progress
              </NavLink>
              {user?.role === 'coach' && (
                <NavLink to="/coach" className={styles.navLink}>
                  Coach home
                </NavLink>
              )}
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={styles.navLink}>
                  Admin
                </NavLink>
              )}
            </>
          )}
        </nav>
        <div className={styles.user}>
          <span className={styles.role}>{user?.full_name}</span>
          <span className={styles.muted}>{user?.role}</span>
          <button type="button" className={styles.logout} onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
