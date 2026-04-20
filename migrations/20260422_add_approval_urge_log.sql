-- migrations/20260422_add_approval_urge_log.sql

CREATE TABLE IF NOT EXISTS approval_urge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL,
  urged_by UUID NOT NULL REFERENCES auth.users(id),
  urged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_urge_log_approval_id
  ON approval_urge_log(approval_id, urged_at DESC);
