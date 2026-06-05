-- Run on existing databases (Aiven / production) to add password reset support.
-- mysqlsh / Workbench: USE defaultdb; then source this file.
-- Local single-db: change the next line if your DB name differs.
USE defaultdb;

-- Password reset tokens. Only the SHA-256 hash of the token is stored (never the
-- raw token), so a database leak can't be used to take over accounts. Tokens are
-- single-use (used_at) and short-lived (expires_at, typically 30 minutes).
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
) ENGINE=InnoDB;
