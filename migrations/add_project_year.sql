-- 为项目表添加归属年份字段
ALTER TABLE projects
ADD COLUMN belong_year INTEGER;

-- 添加注释
COMMENT ON COLUMN projects.belong_year IS '项目归属年份';
