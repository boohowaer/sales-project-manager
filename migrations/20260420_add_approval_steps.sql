-- migrations/20260420_add_approval_steps.sql

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS current_step SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_steps  SMALLINT NOT NULL DEFAULT 1;
