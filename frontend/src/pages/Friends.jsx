import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import './pageLayout.css';
import './Friends.css';

const SEARCH_DEBOUNCE_MS = 250;

function tierLabel(overall) {
  if (overall >= 95) return 'Legendary';
  if (overall >= 90) return 'Elite';
  if (overall >= 80) return 'Pro';
  if (overall >= 70) return 'Contender';
  if (overall >= 65) return 'Prospect';
  return 'Rookie';
}

function tierClass(overall) {
  if (overall >= 90) return 'tier-elite';
  if (overall >= 80) return 'tier-pro';
  if (overall >= 70) return 'tier-contender';
  if (overall >= 65) return 'tier-prospect';
  return 'tier-rookie';
}

function OvrBadge({ overall, size = 'md' }) {
  return (
    <div className={`ovr-badge ovr-${size} ${tierClass(overall || 60)}`}>
      <span className="ovr-num">{overall ?? 60}</span>
      <span className="ovr-label">OVR</span>
    </div>
  );
}

function xpToNextLevel(xp) {
  const safe = Math.max(0, Number(xp) || 0);
  if (60 + Math.floor(safe / 100) >= 99) return null; // capped
  const intoLevel = safe % 100;
  return { current: intoLevel, needed: 100, remaining: 100 - intoLevel };
}

function PersonRow({ person, isSelf, rank, children }) {
  const xpInfo = xpToNextLevel(person.xp);
  const xpPct = xpInfo ? Math.round((xpInfo.current / xpInfo.needed) * 100) : 100;
  return (
    <div className={`friend-row ${isSelf ? 'is-self' : ''}`}>
      {rank != null && <div className="friend-rank">#{rank}</div>}
      <Avatar user={person} size={44} />
      <OvrBadge overall={person.overall} />
      <div className="friend-meta">
        <div className="friend-name">
          {person.full_name}
          {isSelf && <span className="badge badge-athlete" style={{ marginLeft: 8 }}>you</span>}
        </div>
        <div className="friend-tier muted">
          {tierLabel(person.overall || 60)} &middot; {Number(person.xp || 0).toLocaleString()} XP
          {xpInfo && (
            <span className="dim"> &middot; {xpInfo.remaining} XP to next</span>
          )}
        </div>
        <div className="xp-bar" aria-hidden="true">
          <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </div>
      {children && <div className="friend-actions">{children}</div>}
    </div>
  );
}

export default function Friends() {
  const { user, refreshProfile } = useAuth();
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [friendsResp, lb] = await Promise.all([
        apiFetch('/api/friends'),
        apiFetch('/api/friends/leaderboard'),
      ]);
      setData(friendsResp);
      setLeaderboard(lb);
    } catch (err) {
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Debounced live search
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const rows = await apiFetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
        setSearchResults(rows);
      } catch (err) {
        setError(err.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQ]);

  const myEntry = useMemo(
    () => leaderboard.find((row) => row.is_self) || null,
    [leaderboard]
  );

  function flash(msg) {
    setInfo(msg);
    setTimeout(() => setInfo(''), 2400);
  }

  async function sendRequest(targetUserId) {
    setBusyId(`req-${targetUserId}`);
    setError('');
    try {
      const result = await apiFetch('/api/friends/requests', {
        method: 'POST',
        body: { userId: targetUserId },
      });
      flash(result.status === 'accepted' ? 'You are now friends!' : 'Request sent');
      setSearchResults((prev) => prev.filter((u) => u.id !== targetUserId));
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not send request');
    } finally {
      setBusyId(null);
    }
  }

  async function acceptRequest(friendshipId) {
    setBusyId(`acc-${friendshipId}`);
    setError('');
    try {
      await apiFetch(`/api/friends/requests/${friendshipId}/accept`, { method: 'POST' });
      flash('Friend added');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not accept request');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectRequest(friendshipId) {
    setBusyId(`rej-${friendshipId}`);
    setError('');
    try {
      await apiFetch(`/api/friends/requests/${friendshipId}/reject`, { method: 'POST' });
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not reject request');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelOutgoing(otherUserId) {
    setBusyId(`cancel-${otherUserId}`);
    setError('');
    try {
      await apiFetch(`/api/friends/${otherUserId}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not cancel request');
    } finally {
      setBusyId(null);
    }
  }

  async function removeFriend(otherUserId) {
    if (!window.confirm('Remove this friend? They will disappear from your leaderboard.')) return;
    setBusyId(`rm-${otherUserId}`);
    setError('');
    try {
      await apiFetch(`/api/friends/${otherUserId}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not remove friend');
    } finally {
      setBusyId(null);
    }
  }

  // Keep AuthContext.user in sync (so OVR badge in header refreshes if it changed)
  useEffect(() => {
    if (myEntry && user && myEntry.overall !== user.overall) {
      refreshProfile().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEntry?.overall, myEntry?.xp]);

  return (
    <div className="stack fade-up">
      <header className="page-header">
        <p className="eyebrow">Social</p>
        <h1 className="page-title">Friends &amp; leaderboard</h1>
        <p className="page-lead">
          Earn XP by completing workouts (+50) and meals (+25). Every 100 XP raises your overall
          rating by 1, capped at 99. Add friends to compete for the top of the board.
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="success">{info}</p>}

      {/* Personal hero card */}
      {myEntry && (
        <section className="my-overall">
          <OvrBadge overall={myEntry.overall} size="lg" />
          <div className="my-overall-meta">
            <p className="eyebrow">Your rating</p>
            <h2 className="my-overall-name">{myEntry.full_name}</h2>
            <p className="muted">
              {tierLabel(myEntry.overall)} &middot;{' '}
              {Number(myEntry.xp || 0).toLocaleString()} XP earned
            </p>
            {(() => {
              const info2 = xpToNextLevel(myEntry.xp);
              if (!info2) return <p className="muted">You’re at the cap. Legend status.</p>;
              const pct = Math.round((info2.current / info2.needed) * 100);
              return (
                <>
                  <div className="xp-bar xp-bar-lg">
                    <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="muted">
                    {info2.current}/{info2.needed} XP &middot; {info2.remaining} more for OVR{' '}
                    {Math.min(99, (myEntry.overall || 60) + 1)}
                  </p>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* Find friends */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 className="section-title">Find people</h2>
        <input
          type="search"
          className="input"
          placeholder="Search by name or email…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {searching && <p className="muted">Searching…</p>}
        {!searching && searchQ.trim().length >= 2 && searchResults.length === 0 && (
          <p className="muted">No matches. They might already be your friend or have a pending request.</p>
        )}
        {searchResults.length > 0 && (
          <div className="friend-list">
            {searchResults.map((u) => (
              <PersonRow key={u.id} person={u}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => sendRequest(u.id)}
                  disabled={busyId === `req-${u.id}`}
                >
                  {busyId === `req-${u.id}` ? 'Sending\u2026' : 'Send request'}
                </button>
              </PersonRow>
            ))}
          </div>
        )}
      </section>

      {/* Incoming requests */}
      {data.incoming.length > 0 && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="spread">
            <h2 className="section-title">Friend requests</h2>
            <span className="badge">{data.incoming.length} new</span>
          </div>
          <div className="friend-list">
            {data.incoming.map((row) => (
              <PersonRow key={row.friendship_id} person={row}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => acceptRequest(row.friendship_id)}
                  disabled={busyId === `acc-${row.friendship_id}`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => rejectRequest(row.friendship_id)}
                  disabled={busyId === `rej-${row.friendship_id}`}
                >
                  Reject
                </button>
              </PersonRow>
            ))}
          </div>
        </section>
      )}

      {/* Outgoing pending */}
      {data.outgoing.length > 0 && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 className="section-title">Pending invitations</h2>
          <div className="friend-list">
            {data.outgoing.map((row) => (
              <PersonRow key={row.friendship_id} person={row}>
                <span className="badge">awaiting</span>
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => cancelOutgoing(row.id)}
                  disabled={busyId === `cancel-${row.id}`}
                >
                  Cancel
                </button>
              </PersonRow>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="spread">
          <h2 className="section-title">Leaderboard</h2>
          <span className="muted">{leaderboard.length} on the board</span>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : leaderboard.length <= 1 ? (
          <div className="empty">
            <h3>No friends yet</h3>
            <p>Search for someone above and send them a request to start competing.</p>
          </div>
        ) : (
          <div className="friend-list">
            {leaderboard.map((row, idx) => (
              <PersonRow key={row.id} person={row} isSelf={!!row.is_self} rank={idx + 1}>
                {!row.is_self && data.friends.some((f) => f.id === row.id) && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeFriend(row.id)}
                    disabled={busyId === `rm-${row.id}`}
                    title="Remove friend"
                  >
                    Remove
                  </button>
                )}
              </PersonRow>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
