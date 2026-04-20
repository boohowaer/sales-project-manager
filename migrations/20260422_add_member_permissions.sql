-- migrations/20260422_add_member_permissions.sql

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS data_scope TEXT
    CHECK (data_scope IN ('own', 'team'))
    DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS approval_cc BOOLEAN
    DEFAULT false;

-- super_admin 和 sales_manager 默认 team 范围
UPDATE team_members
  SET data_scope = 'team'
  WHERE role IN ('super_admin', 'sales_manager')
    AND data_scope = 'own';
