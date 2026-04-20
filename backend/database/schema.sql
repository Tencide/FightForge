-- FightForge – MySQL schema (SE/COM S 3190)
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS fightforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fightforge;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('athlete', 'coach', 'admin') NOT NULL DEFAULT 'athlete',
  coach_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  athlete_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meals_athlete FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_meals_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_users_coach ON users(coach_id);
CREATE INDEX idx_workouts_athlete ON workouts(athlete_id);
CREATE INDEX idx_meals_athlete ON meals(athlete_id);
CREATE INDEX idx_progress_user ON progress_entries(user_id);
CREATE INDEX idx_messages_pair ON messages(sender_id, recipient_id);
