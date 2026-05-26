const path = require('path');
const { pool } = require('../config/db');
const { publicPathForFilename, deleteUploadedFile } = require('./reelUploads');
const { ensurePlaybackMp4, getTranscodePlan } = require('./transcode');

/** Reel IDs still being transcoded (in-process; single Fly machine). */
const processingIds = new Set();

function isReelProcessing(reelId) {
  return processingIds.has(Number(reelId));
}

/**
 * Transcode after upload response is sent. Returns true if background work was queued.
 */
function scheduleReelTranscode(reelId, diskPath) {
  const plan = getTranscodePlan(diskPath);
  if (plan === 'none') return false;

  const id = Number(reelId);
  processingIds.add(id);

  setImmediate(() => {
    runReelTranscode(id, diskPath, plan).finally(() => {
      processingIds.delete(id);
    });
  });

  return true;
}

async function runReelTranscode(reelId, diskPath, plan) {
  try {
    const finalPath = await ensurePlaybackMp4(diskPath, { plan, preset: 'ultrafast' });
    const newUrl = publicPathForFilename(path.basename(finalPath));

    const [rows] = await pool.query('SELECT video_url FROM reels WHERE id = ?', [reelId]);
    if (!rows.length) return;

    const oldUrl = rows[0].video_url;
    if (oldUrl === newUrl) return;

    await pool.query('UPDATE reels SET video_url = ? WHERE id = ?', [newUrl, reelId]);
    if (oldUrl) deleteUploadedFile(oldUrl);
  } catch (err) {
    console.error('reel background transcode failed:', err.message || err);
  }
}

module.exports = { scheduleReelTranscode, isReelProcessing };
