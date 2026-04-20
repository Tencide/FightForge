import { Link } from 'react-router-dom';
import './pageLayout.css';

export default function NotFound() {
  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <h1 className="page-title">Page not found</h1>
      <p className="page-lead">That route does not exist in FightForge.</p>
      <Link className="btn btn-primary" to="/">
        Return home
      </Link>
    </div>
  );
}
