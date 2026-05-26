const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PLAYABLE_EXT = new Set(['.mp4', '.m4v', '.webm', '.mov']);

/** What to do after upload: none (MP4), remux (fast copy), encode (full transcode). */
function getTranscodePlan(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.mp4') return 'none';
  if (ext === '.m4v') return 'remux';
  if (ext === '.mov' || ext === '.webm') return 'encode';
  if (PLAYABLE_EXT.has(ext)) return 'encode';
  return 'none';
}

/**
 * Convert uploaded reel to H.264 MP4 (+faststart) for cross-browser playback.
 * plan: 'encode' | 'remux' | 'none' (from getTranscodePlan). Returns final path.
 */
async function ensurePlaybackMp4(inputPath, options = {}) {
  const plan = options.plan ?? getTranscodePlan(inputPath);
  if (plan === 'none') return inputPath;

  const ext = path.extname(inputPath).toLowerCase();
  if (!PLAYABLE_EXT.has(ext)) return inputPath;

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, ext);
  const outPath = path.join(dir, `${base}.mp4`);
  const preset = options.preset || 'veryfast';

  if (plan === 'remux' && ext === '.mp4') {
    return remuxFaststart(inputPath);
  }

  if (plan === 'remux' && ext === '.m4v') {
    try {
      await execFileAsync(
        'ffmpeg',
        ['-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outPath],
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
      );
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
        if (inputPath !== outPath) {
          try {
            fs.unlinkSync(inputPath);
          } catch {
            /* ignore */
          }
        }
        return outPath;
      }
    } catch (err) {
      console.warn('ffmpeg remux failed:', err.message || err);
    }
    return inputPath;
  }

  if (ext === '.mp4' && inputPath === outPath) {
    return remuxFaststart(inputPath);
  }

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        preset,
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        outPath,
      ],
      { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 }
    );

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      if (inputPath !== outPath) {
        try {
          fs.unlinkSync(inputPath);
        } catch {
          /* ignore */
        }
      }
      return outPath;
    }
  } catch (err) {
    console.warn('ffmpeg transcode failed:', err.message || err);
    if (fs.existsSync(outPath)) {
      try {
        fs.unlinkSync(outPath);
      } catch {
        /* ignore */
      }
    }
  }

  return inputPath;
}

/** MP4 already — add faststart for streaming without full re-encode when possible. */
async function remuxFaststart(inputPath) {
  const tmp = `${inputPath}.faststart.mp4`;
  try {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', tmp],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
      fs.renameSync(tmp, inputPath);
    }
  } catch {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
  return inputPath;
}

/** @deprecated use ensurePlaybackMp4 */
async function transcodeMovToMp4(inputPath) {
  return ensurePlaybackMp4(inputPath);
}

module.exports = { ensurePlaybackMp4, transcodeMovToMp4, getTranscodePlan };
