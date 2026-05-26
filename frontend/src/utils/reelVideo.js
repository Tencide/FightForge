/** ~800 kbps video + 64 kbps audio — good for short reels, much smaller files. */
export const REEL_RECORDER_BITS = {
  videoBitsPerSecond: 800_000,
  audioBitsPerSecond: 64_000,
};

export const REEL_CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'environment',
    width: { ideal: 720, max: 1280 },
    height: { ideal: 1280, max: 1920 },
    frameRate: { ideal: 24, max: 30 },
  },
  audio: true,
};

/** Prefer MP4 when supported (Safari/iOS), else VP8 WebM for Chrome/Android. */
export function pickRecorderMime() {
  const types = [
    'video/mp4',
    'video/mp4;codecs=avc1,mp4a',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

export function extForMime(mime) {
  if (mime?.includes('mp4')) return '.mp4';
  return '.webm';
}

export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const COMPRESS_ABOVE_BYTES = 20 * 1024 * 1024;
const SKIP_MP4_BELOW_BYTES = 28 * 1024 * 1024;

/** Large files only — server transcodes non-MP4 in the background. */
export function needsReelTranscode(blob) {
  if (!blob) return false;
  if (blob.size <= COMPRESS_ABOVE_BYTES) return false;
  if (blob.type?.includes('mp4') && blob.size < SKIP_MP4_BELOW_BYTES) return false;
  return true;
}

/**
 * Re-encode to WebM/MP4 for cross-browser playback and smaller uploads.
 * Falls back to the original blob if compression isn't supported or fails.
 */
export async function prepareReelVideo(blob, { onStatus } = {}) {
  if (!blob || !needsReelTranscode(blob)) return blob;

  if (typeof document === 'undefined' || !HTMLVideoElement.prototype.captureStream) {
    return blob;
  }

  onStatus?.('Optimizing video for upload…');

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = false;
  video.src = url;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video'));
    });

    const stream = video.captureStream(24);
    const mime = pickRecorderMime();
    const rec = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      ...REEL_RECORDER_BITS,
    });

    const chunks = [];
    rec.ondataavailable = (ev) => {
      if (ev.data?.size) chunks.push(ev.data);
    };

    const done = new Promise((resolve) => {
      rec.onstop = () => {
        const out = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        resolve(out.size > 0 && out.size < blob.size ? out : blob);
      };
    });

    rec.start(400);
    await video.play();
    await new Promise((resolve) => {
      video.onended = resolve;
      video.onerror = resolve;
    });
    if (rec.state !== 'inactive') rec.stop();
    return await done;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
  }
}
