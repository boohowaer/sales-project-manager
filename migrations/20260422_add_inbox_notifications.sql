-- migrations/20260422_add_inbox_notifications.sql

CREATE TABLE IF NOT EXISTS inbox_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN (
    'task_overdue', 'task_upcoming', 'milestone',
    'approval_submitted', 'approval_approved', 'approval_rejected',
    'approval_cc', 'approval_urge', 'approval_urge_received'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link_type TEXT CHECK (link_type IN ('task', 'approval', 'project')),
  link_id TEXT,
  is_read BOOLEAN DEFAULT false,
  browser_pushed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_notifications_user_created
  ON inbox_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_notifications_unpushed
  ON inbox_notifications(user_id, browser_pushed)
  WHERE browser_pushed = false;

ALTER TABLE inbox_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON inbox_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON inbox_notifications FOR UPDATE
  USING (auth.uid() = user_id);
