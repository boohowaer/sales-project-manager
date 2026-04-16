-- 添加项目状态 "已归档" (archived)
-- 这个迁移将修改 projects 表的 status 字段约束，添加 archived 状态

-- 删除旧的约束
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- 添加新的约束，包含 archived 状态
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'won', 'lost', 'on_hold', 'archived'));
