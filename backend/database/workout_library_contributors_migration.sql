-- Run on existing defaultdb after initial schema.
USE defaultdb;

ALTER TABLE workout_library
  ADD COLUMN created_by INT UNSIGNED NULL DEFAULT NULL AFTER goal_alignment,
  ADD CONSTRAINT fk_workout_library_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_workout_library_creator ON workout_library(created_by);
