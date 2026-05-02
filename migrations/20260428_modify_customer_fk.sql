-- 修改 projects 表的 customer_id 外键约束
-- 从 ON DELETE CASCADE 改为 ON DELETE SET NULL

-- 先删除现有的外键约束
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_customer_id_fkey;

-- 添加新的外键约束（允许 NULL，删除客户时设为 NULL）
ALTER TABLE projects
ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE projects
ADD CONSTRAINT projects_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
