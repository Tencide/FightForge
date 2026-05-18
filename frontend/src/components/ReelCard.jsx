import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import YouTubePlayer from './YouTubePlayer';
import Icon from './Icon';
import { resolveMediaUrl } from '../api/client';
import { getYouTubeId } from '../utils/youtube';

const SPORT_LABELS = {
  mma: 'MMA',
  boxing: 'Boxing',
  bjj: 'BJJ',
  kickboxing: 'Kickboxing',
  wrestling: 'Wrestling',
  muay_thai: 'Muay Thai',
  general: 'Combat',
};

export default function ReelCard({
  reel,
  active,
  onLike,
  onDelete,
  canDelete,
  liking,
}) {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [shareOk, setShareOk] = useState(false);
  const youtubeId = reel.videoKind === 'youtube' ? getYouTubeId(reel.videoUrl) : null;
  const mediaSrc = resolveMediaUrl(reel.videoUrl);
  const isDirect = reel.videoKind === 'direct' && !videoError;

  useEffect(() => {
    setVideoError(false);
    setSoundOn(false);
    setShareOk(false);
  }, [reel.id, reel.videoUrl]);

  useEffect(() => {
    if (!active) setSoundOn(false);
  }, [active]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isDirect) return undefined;
    el.muted = !soundOn;
    if (active) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
    return undefined;
  }, [active, isDirect, soundOn]);

  async function handleShare() {
    const url = `${window.location.origin}/reels?reel=${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FightForge reel', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareOk(true);
      window.setTimeout(() => setShareOk(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <article className="reel-slide" data-active={active ? 'true' : 'false'}>
      <div className="reel-media">
        {youtubeId ? (
          <YouTubePlayer videoId={youtubeId} autoplay={active} compact />
        ) : reel.videoKind === 'direct' ? (
          videoError ? (
            <div className="reel-link-fallback">
              <Icon name="video" size={32} />
              <p className="muted">Clip format not supported in this browser.</p>
              <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="btn btn-subtle btn-sm">
                Open video
              </a>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="reel-video-native"
              src={mediaSrc}
              playsInline
              muted={!soundOn}
              loop
              controls={active}
              preload="metadata"
              onError={() => setVideoError(true)}
            />
          )
        ) : (
          <div className="reel-link-fallback">
            <Icon name="video" size={32} />
            <p className="muted">Open clip in browser</p>
            <a href={mediaSrc || reel.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-subtle btn-sm">
              Watch video
            </a>
          </div>
        )}
      </div>

      <div className="reel-overlay">
        <div className="reel-meta">
          <div className="reel-author">
            <Avatar user={reel.author} size={36} />
            <div>
              <strong>{reel.author?.fullName}</strong>
              <span className={`badge badge-${reel.author?.role || 'athlete'}`}>{reel.author?.role}</span>
            </div>
          </div>
          {reel.caption ? <p className="reel-caption">{reel.caption}</p> : null}
          <span className="badge">{SPORT_LABELS[reel.sport] || reel.sport}</span>
        </div>

        <div className="reel-actions">
          {isDirect ? (
            <button
              type="button"
              className="reel-action-btn"
              onClick={() => setSoundOn((v) => !v)}
              aria-label={soundOn ? 'Mute' : 'Unmute'}
              aria-pressed={soundOn}
            >
              <Icon name={soundOn ? 'volume-on' : 'volume-off'} size={22} />
            </button>
          ) : null}
          <button
            type="button"
            className={`reel-action-btn ${reel.likedByMe ? 'is-liked' : ''}`}
            onClick={() => onLike(reel)}
            disabled={liking}
            aria-pressed={reel.likedByMe}
            aria-label={reel.likedByMe ? 'Unlike' : 'Like'}
          >
            <Icon name="heart" size={22} />
            <span>{reel.likeCount}</span>
          </button>
          <button type="button" className="reel-action-btn" onClick={handleShare} aria-label="Share reel">
            <Icon name="share" size={20} />
            <span>{shareOk ? 'Copied' : 'Share'}</span>
          </button>
          {canDelete ? (
            <button
              type="button"
              className="reel-action-btn"
              onClick={() => onDelete(reel)}
              aria-label="Delete reel"
            >
              <Icon name="trash" size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
