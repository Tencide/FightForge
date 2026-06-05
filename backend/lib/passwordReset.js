const crypto = require('crypto');

// Reset links are valid for 30 minutes.
const RESET_TTL_MS = 30 * 60 * 1000;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_password_reset_token (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB`;

/** Create the password_resets table if it doesn't exist (idempotent). */
async function ensurePasswordResetTable(pool) {
  await pool.query(CREATE_TABLE_SQL);
}

/** Random URL-safe token (raw) plus its SHA-256 hash for storage. */
function createResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashResetToken(raw);
  return { raw, hash };
}

function hashResetToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

module.exports = {
  RESET_TTL_MS,
  ensurePasswordResetTable,
  createResetToken,
  hashResetToken,
};
