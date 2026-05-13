-- FightForge – MySQL schema
-- Run: mysql -u root -p < database/schema.sql
--
-- If your provider only gives one database (no CREATE DATABASE): use
-- `database/schema.single_mysql_database.sql` (edit the first `USE …` line),
-- or replace the first two statements here with `USE your_db_name;`.

CREATE DATABASE IF NOT EXISTS fightforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fightforge;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('athlete', 'coach', 'admin') NOT NULL DEFAULT 'athlete',
  coach_id INT UNSIGNED NULL,
  profile JSON DEFAULT NULL,
  -- Data URL of a client-resized JPEG (typically 256x256 ~30 KB). MEDIUMTEXT
  -- caps at 16 MB which is far more than needed; server-side size limit is
  -- enforced in the route handler.
  avatar_url MEDIUMTEXT DEFAULT NULL,
  -- Madden-style player rating. Everyone starts at 60. Each 100 XP earned by
  -- completing workouts/meals raises overall by 1, capped at 99.
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  overall TINYINT UNSIGNED NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Friend graph. One row per directed request; once accepted, both users see
-- each other on their leaderboards. Status:
--   pending  — waiting for recipient to accept
--   accepted — friendship is mutual + active
CREATE TABLE IF NOT EXISTS friendships (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_friend_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_friend_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uniq_friend_pair UNIQUE (requester_id, recipient_id),
  CONSTRAINT chk_no_self_friend CHECK (requester_id <> recipient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  video_url VARCHAR(500) DEFAULT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workouts_athlete FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_workouts_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  athlete_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  target_calories INT UNSIGNED NULL,
  protein_g INT UNSIGNED NULL,
  carbs_g INT UNSIGNED NULL,
  fat_g INT UNSIGNED NULL,
  notes TEXT,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meals_athlete FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_meals_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Curated library of workout templates the auto-generator can pull from.
CREATE TABLE IF NOT EXISTS workout_library (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  video_url VARCHAR(500) DEFAULT NULL,
  category VARCHAR(50) NOT NULL,
  experience_level ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
  duration_min INT UNSIGNED NOT NULL DEFAULT 60,
  goal_alignment VARCHAR(50) NOT NULL DEFAULT 'cut,maintain,bulk',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Curated library of meal items the daily meal generator pulls from.
CREATE TABLE IF NOT EXISTS meal_library (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  meal_type ENUM('breakfast','lunch','dinner','snack') NOT NULL,
  calories INT UNSIGNED NOT NULL,
  protein_g INT UNSIGNED NOT NULL,
  carbs_g INT UNSIGNED NOT NULL,
  fat_g INT UNSIGNED NOT NULL,
  goal_alignment VARCHAR(50) NOT NULL DEFAULT 'cut,maintain,bulk',
  dietary_tag VARCHAR(50) NOT NULL DEFAULT 'none',
  prep_minutes INT UNSIGNED NOT NULL DEFAULT 15,
  ingredients TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS progress_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  weight_lb DECIMAL(6,1) NULL,
  body_fat_pct DECIMAL(5,2) NULL,
  bench_press_lb INT UNSIGNED NULL,
  squat_lb INT UNSIGNED NULL,
  cardio_minutes INT UNSIGNED NULL,
  notes TEXT,
  recorded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Messages are ephemeral by default: once the recipient sees one, it
-- self-destructs ~60s later (lazy cleanup on every GET) unless either party
-- "saves" it. The saved flag persists the message indefinitely.
CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  seen_at TIMESTAMP NULL DEFAULT NULL,
  saved TINYINT(1) NOT NULL DEFAULT 0,
  saved_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_saver FOREIGN KEY (saved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_users_coach ON users(coach_id);
CREATE INDEX idx_workouts_athlete ON workouts(athlete_id);
CREATE INDEX idx_meals_athlete ON meals(athlete_id);
CREATE INDEX idx_progress_user ON progress_entries(user_id);
CREATE INDEX idx_messages_pair ON messages(sender_id, recipient_id);
CREATE INDEX idx_meal_library_type ON meal_library(meal_type);
CREATE INDEX idx_workout_library_category ON workout_library(category);
CREATE INDEX idx_friendships_recipient ON friendships(recipient_id, status);
CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
