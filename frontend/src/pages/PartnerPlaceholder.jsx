import { Link } from 'react-router-dom';
import './pageLayout.css';

export default function PartnerPlaceholder({ title, children }) {
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1 className="page-title">{title}</h1>
      <p className="page-lead">
        {children ||
          'This area is assigned to your teammate for the FightForge split. Once their routes are merged, this path will show the full experience.'}
      </p>
      <Link className="btn btn-ghost" to="/">
        Back to home
      </Link>
    </div>
  );
}
