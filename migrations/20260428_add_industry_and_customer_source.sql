-- 添加行业分类字段到customers表
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;

-- 添加客户来源字段到projects表
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_source TEXT;

-- 添加注释
COMMENT ON COLUMN customers.industry IS '行业分类，存储字典key';
COMMENT ON COLUMN projects.customer_source IS '客户来源，存储字典key';
