import './Avatar.css';

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Circular avatar that shows the user's photo if they have one and falls
 * back to colored initials otherwise.
 *
 * Props:
 *   - user: { full_name, avatar_url } (or any object with those keys)
 *   - size: pixels (default 36)
 *   - className: optional extra class on the outer element
 *   - title: optional tooltip
 */
export default function Avatar({ user, size = 36, className = '', title }) {
  const url = user?.avatar_url || user?.avatarUrl || null;
  const name = user?.full_name || user?.fullName || '';
  const fontSize = Math.max(10, Math.round(size * 0.36));
  const style = { width: size, height: size, fontSize };

  if (url) {
    return (
      <img
        className={`avatar avatar-img ${className}`.trim()}
        src={url}
        alt={name || 'avatar'}
        title={title || name}
        style={style}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`avatar avatar-initials ${className}`.trim()}
      title={title || name}
      aria-label={name ? `${name} avatar` : 'avatar'}
      style={style}
    >
      {initialsFromName(name)}
    </span>
  );
}
