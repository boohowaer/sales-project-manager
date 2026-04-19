-- data_dictionary
CREATE TABLE data_dictionary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  category    TEXT NOT NULL,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, category, key)
);

-- RLS: 同团队成员可读，超管可写（写操作通过 service role 绕过 RLS）
ALTER TABLE data_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can read dictionary"
  ON data_dictionary FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));
