-- 新增 task_shares 表，记录任务的指派和同步关系
CREATE TABLE IF NOT EXISTS task_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('assign', 'sync')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (task_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_shares_task_id ON task_shares(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_from_user ON task_shares(from_user_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_to_user ON task_shares(to_user_id);

ALTER TABLE task_shares ENABLE ROW LEVEL SECURITY;

-- 任务创建者可以管理自己任务的共享
CREATE POLICY "task owner can manage shares"
  ON task_shares FOR ALL
  USING (from_user_id = auth.uid());

-- 被共享的人可以查看自己收到的共享
CREATE POLICY "shared user can view their shares"
  ON task_shares FOR SELECT
  USING (to_user_id = auth.uid());
