-- 为现有表加 team_id（可为空，兼容历史数据）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE projects  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE settlement_stages ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE weekly_updates    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- 更新 customers RLS：同团队成员可见，或 team_id 为空时仅自己可见（兼容历史数据）
DROP POLICY IF EXISTS "Users can only see their own customers" ON customers;
CREATE POLICY "Users can see own or team customers"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- 更新 projects RLS
DROP POLICY IF EXISTS "Users can only see their own projects" ON projects;
CREATE POLICY "Users can see own or team projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- 更新 tasks RLS
DROP POLICY IF EXISTS "Users can only see their own tasks" ON tasks;
CREATE POLICY "Users can see own or team tasks"
  ON tasks FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
