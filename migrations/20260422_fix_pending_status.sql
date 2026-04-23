-- 1. 更新 team_members.status 约束，加入 pending
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('active', 'pending', 'disabled'));

-- 2. 允许用户读取自己的成员记录（含 pending 状态），让中间件能正确判断跳转
CREATE POLICY "users can view own member record"
  ON team_members FOR SELECT
  USING (user_id = auth.uid());
