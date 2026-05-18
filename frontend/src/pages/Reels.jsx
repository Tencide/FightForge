import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import ReelCard from '../components/ReelCard';
import ReelPostForm from '../components/ReelPostForm';
import './Reels.css';

const SPORTS = [
  { value: '', label: 'All' },
  { value: 'mma', label: 'MMA' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'bjj', label: 'BJJ' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'general', label: 'General' },
];

export default function Reels() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const deepLinkId = Number(searchParams.get('reel')) || null;
  const [reels, setReels] = useState([]);
  const [sport, setSport] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [likingId, setLikingId] = useState(null);
  const [showPost, setShowPost] = useState(false);

  const feedRef = useRef(null);
  const slideRefs = useRef([]);

  const loadFeed = useCallback(async (reset = false) => {
    const offset = reset ? 0 : reels.length;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const q = new URLSearchParams({ limit: '15', offset: String(offset) });
      if (sport) q.set('sport', sport);
      const data = await apiFetch(`/api/reels?${q}`);
      const next = data.reels || [];
      setReels((prev) => (reset ? next : [...prev, ...next]));
      if (reset) setActiveIndex(0);
    } catch (e) {
      setError(e.message || 'Failed to load reels');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sport, reels.length]);

  useEffect(() => {
    setReels([]);
    loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload feed when sport filter changes
  }, [sport]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
          const idx = Number(entry.target.dataset.index);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
        });
      },
      { root, threshold: [0.55, 0.75] }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    if (!deepLinkId || !reels.length || !feedRef.current) return;
    const idx = reels.findIndex((r) => r.id === deepLinkId);
    if (idx < 0) return;
    setActiveIndex(idx);
    const el = slideRefs.current[idx];
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [deepLinkId, reels]);

  async function handleLike(reel) {
    setLikingId(reel.id);
    try {
      const path = reel.likedByMe ? `/api/reels/${reel.id}/like` : `/api/reels/${reel.id}/like`;
      const method = reel.likedByMe ? 'DELETE' : 'POST';
      const data = await apiFetch(path, { method });
      setReels((prev) =>
        prev.map((r) =>
          r.id === reel.id
            ? { ...r, likedByMe: data.liked ?? !reel.likedByMe, likeCount: data.likeCount }
            : r
        )
      );
    } catch (e) {
      setError(e.message || 'Like failed');
    } finally {
      setLikingId(null);
    }
  }

  async function handleDelete(reel) {
    if (!window.confirm('Delete this reel?')) return;
    try {
      await apiFetch(`/api/reels/${reel.id}`, { method: 'DELETE' });
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  }

  function handlePosted(reel) {
    setReels((prev) => [reel, ...prev]);
    setShowPost(false);
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onFeedScroll() {
    const el = feedRef.current;
    if (!el || loadingMore || loading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      loadFeed(false);
    }
  }

  return (
    <div className="reels-app fade-up">
      <header className="reels-toolbar">
        <div>
          <h1 className="reels-toolbar-title">Reels</h1>
          <p className="muted reels-toolbar-sub">Combat sports clips from the community</p>
        </div>
        <div className="reels-toolbar-actions">
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={() => loadFeed(true)}
            disabled={loading}
            aria-label="Refresh feed"
          >
            <Icon name="refresh" size={16} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPost((v) => !v)}>
            <Icon name="plus" size={16} />
            {showPost ? 'Close' : 'Post'}
          </button>
        </div>
      </header>

      {showPost ? (
        <ReelPostForm onPosted={handlePosted} onError={setError} />
      ) : null}

      <div className="reels-filters">
        {SPORTS.map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            className={`reels-filter-chip ${sport === s.value ? 'is-active' : ''}`}
            onClick={() => setSport(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !reels.length ? (
        <p className="muted reels-status">Loading reels…</p>
      ) : null}

      {!loading && !reels.length ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="video" size={22} />
          </div>
          <h3>No reels yet</h3>
          <p>Be the first to post training, sparring, or camp footage.</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowPost(true)}>
            Post a reel
          </button>
        </div>
      ) : null}

      <div className="reels-feed" ref={feedRef} onScroll={onFeedScroll}>
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            data-index={index}
            className="reels-slide-wrap"
          >
            <ReelCard
              reel={reel}
              active={index === activeIndex}
              onLike={handleLike}
              onDelete={handleDelete}
              canDelete={reel.authorId === user?.id || user?.role === 'admin'}
              liking={likingId === reel.id}
            />
          </div>
        ))}
        {loadingMore ? <p className="muted reels-status">Loading more…</p> : null}
      </div>
    </div>
  );
}
