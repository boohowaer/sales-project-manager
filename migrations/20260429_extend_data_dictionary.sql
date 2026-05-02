-- ============================================================
-- 数据字典扩展：支持模块分类、父子级联、字段元数据
-- ============================================================

-- 1. 扩展 data_dictionary 表
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES data_dictionary(id) ON DELETE SET NULL;
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS field_key TEXT;
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 添加注释
COMMENT ON COLUMN data_dictionary.parent_id IS '父级ID，用于级联选项';
COMMENT ON COLUMN data_dictionary.level IS '层级：1=顶级，2=子级';
COMMENT ON COLUMN data_dictionary.module IS '所属模块：customer/project';
COMMENT ON COLUMN data_dictionary.field_key IS '字段英文key：company/customer_source/industry/project_status';
COMMENT ON COLUMN data_dictionary.display_name IS '字段显示名称，可修改';

-- 2. 创建字段元数据表 dictionary_fields
CREATE TABLE IF NOT EXISTS dictionary_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  field_key TEXT NOT NULL,
  module TEXT NOT NULL,
  display_name TEXT NOT NULL,
  supports_cascade BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, field_key)
);

-- RLS 策略
ALTER TABLE dictionary_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can read dictionary_fields"
  ON dictionary_fields FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- 3. 为 parent_id 创建索引
CREATE INDEX IF NOT EXISTS idx_data_dictionary_parent_id ON data_dictionary(parent_id);
CREATE INDEX IF NOT EXISTS idx_data_dictionary_module ON data_dictionary(module);
CREATE INDEX IF NOT EXISTS idx_data_dictionary_field_key ON data_dictionary(field_key);

-- ============================================================
-- 数据迁移（需根据实际环境手动执行）
-- ============================================================

-- 更新现有字典数据，补上 module 和 field_key
-- UPDATE data_dictionary SET module = 'project', field_key = 'customer_source' WHERE category = 'customer_source';
-- UPDATE data_dictionary SET module = 'project', field_key = 'industry' WHERE category = 'industry';

-- 插入 dictionary_fields 元数据（需要替换 team_id）
-- INSERT INTO dictionary_fields (team_id, field_key, module, display_name, supports_cascade, sort_order) VALUES
--   ('<team_id>', 'company', 'customer', '公司名称', false, 1),
--   ('<team_id>', 'customer_source', 'project', '客户来源', true, 2),
--   ('<team_id>', 'industry', 'project', '行业归属', true, 3),
--   ('<team_id>', 'project_status', 'project', '项目状态', false, 4);

-- 插入 project_status 字典数据（需要替换 team_id）
-- INSERT INTO data_dictionary (team_id, category, key, label, sort_order, module, field_key, level) VALUES
--   ('<team_id>', 'project_status', 'active', '跟进中', 1, 'project', 'project_status', 1),
--   ('<team_id>', 'project_status', 'won', '已成交', 2, 'project', 'project_status', 1),
--   ('<team_id>', 'project_status', 'lost', '已丢失', 3, 'project', 'project_status', 1),
--   ('<team_id>', 'project_status', 'on_hold', '暂停', 4, 'project', 'project_status', 1),
--   ('<team_id>', 'project_status', 'archived', '已归档', 5, 'project', 'project_status', 1);

-- 迁移 customers.company 历史数据到字典（需要替换 team_id）
-- INSERT INTO data_dictionary (team_id, category, key, label, sort_order, module, field_key, level)
-- SELECT '<team_id>', 'company', company, company, row_number() OVER (), 'customer', 'company', 1
-- FROM customers WHERE company IS NOT NULL AND company != '' AND team_id = '<team_id>'
-- GROUP BY company;

-- 更新 customers 表，将 company 字段改为存储字典 key（可选，视需求而定）
-- 注意：如果要保留原值，可以创建新字段 company_dict_key 存储 key