-- 添加项目状态管理字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_start_notice BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS settlement_stages INTEGER DEFAULT 1;

-- 创建结算段表
CREATE TABLE IF NOT EXISTS settlement_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  stage_name TEXT,
  amount DECIMAL(12,2),
  accepted BOOLEAN DEFAULT false,
  accepted_date DATE,
  invoiced BOOLEAN DEFAULT false,
  invoiced_date DATE,
  paid BOOLEAN DEFAULT false,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_stages_project_id ON settlement_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_settlement_stages_stage_number ON settlement_stages(project_id, stage_number);

-- 启用RLS
ALTER TABLE settlement_stages ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户可以查看自己项目的结算段" ON settlement_stages
    FOR SELECT USING (project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    ));

CREATE POLICY "用户可以插入自己项目的结算段" ON settlement_stages
    FOR INSERT WITH CHECK (project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    ));

CREATE POLICY "用户可以更新自己项目的结算段" ON settlement_stages
    FOR UPDATE USING (project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    ));

CREATE POLICY "用户可以删除自己项目的结算段" ON settlement_stages
    FOR DELETE USING (project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    ));

-- 添加更新时间戳触发器
CREATE TRIGGER update_settlement_stages_updated_at BEFORE UPDATE ON settlement_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
