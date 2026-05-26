import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import ReelYouTube from './ReelYouTube';
import Icon from './Icon';
import { resolveMediaUrl, apiFetch } from '../api/client';
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
  onReelUpdate,
  canDelete,
  liking,
}) {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [shareOk, setShareOk] = useState(false);
  const youtubeId = reel.videoKind === 'youtube' ? getYouTubeId(reel.videoUrl) : null;
  const mediaSrc = resolveMediaUrl(reel.videoUrl);
  const proxySrc =
    reel.videoUrl && reel.videoUrl.startsWith('/api/') ? reel.videoUrl : null;
  const [videoSrc, setVideoSrc] = useState('');
  const isDirect = reel.videoKind === 'direct' && !videoError;
  const processing = Boolean(reel.videoProcessing);

  useEffect(() => {
    if (!processing || !onReelUpdate) return undefined;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled || attempts > 45) return;
      attempts += 1;
      try {
        const data = await apiFetch(`/api/reels/${reel.id}`);
        if (cancelled) return;
        if (!data.reel?.videoProcessing) onReelUpdate(data.reel);
      } catch {
        /* retry */
      }
    };
    const id = setInterval(tick, 2000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [reel.id, processing, onReelUpdate]);

  useEffect(() => {
    setVideoError(false);
    setIsPlaying(false);
    setSoundOn(false);
    setShareOk(false);
    setVideoSrc('');
  }, [reel.id, reel.videoUrl]);

  useEffect(() => {
    if (!isDirect || !active) {
      setVideoSrc('');
      return;
    }
    setVideoError(false);
    setVideoSrc(mediaSrc);
  }, [isDirect, active, mediaSrc, reel.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isDirect) return undefined;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [isDirect, videoSrc]);

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
  }, [active, isDirect, soundOn, videoSrc]);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

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
          <ReelYouTube videoUrl={reel.videoUrl} caption={reel.caption} />
        ) : reel.videoKind === 'direct' ? (
          videoError ? (
            <div className="reel-link-fallback">
              <Icon name="video" size={32} />
              <p className="muted">Couldn&apos;t load this clip.</p>
              <a href={mediaSrc || proxySrc} target="_blank" rel="noopener noreferrer" className="btn btn-subtle btn-sm">
                Open video
              </a>
            </div>
          ) : (
            <div className="reel-video-wrap">
              {videoSrc ? (
                <video
                  ref={videoRef}
                  className="reel-video-native"
                  src={videoSrc}
                  playsInline
                  muted={!soundOn}
                  loop
                  preload="metadata"
                  onClick={togglePlay}
                  onError={(e) => {
                    const code = e.currentTarget?.error?.code;
                    if (code === 1) return;
                    if (videoSrc === mediaSrc && proxySrc && mediaSrc !== proxySrc) {
                      setVideoSrc(proxySrc);
                      return;
                    }
                    setVideoError(true);
                  }}
                />
              ) : (
                <p className="reel-video-loading muted">
                  {processing ? 'Optimizing clip…' : 'Loading clip…'}
                </p>
              )}
              {processing ? (
                <p className="reel-video-processing muted" aria-live="polite">
                  Finishing upload…
                </p>
              ) : null}
              <button
                type="button"
                className={`reel-play-btn ${isPlaying ? 'is-hidden' : ''}`}
                onClick={togglePlay}
                aria-label="Play video"
              >
                <Icon name="play" size={32} />
              </button>
            </div>
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
