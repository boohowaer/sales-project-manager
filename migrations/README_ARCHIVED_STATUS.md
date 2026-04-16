# 添加"已归档"项目状态 - 迁移指南

## 问题描述
项目管理页面需要支持"已归档"状态，但当前数据库的 `projects` 表中 `status` 字段只允许以下值：
- `active` (跟进中)
- `won` (已成交)
- `lost` (已丢失)
- `on_hold` (暂停)

需要添加 `archived` (已归档) 状态。

## 解决方案

### 方法一：在 Supabase Dashboard 中执行（推荐）

1. 访问您的 Supabase 项目：https://supabase.com/dashboard
2. 选择您的项目
3. 在左侧菜单中点击 **"SQL Editor"**
4. 点击 **"New Query"**
5. 复制并粘贴以下 SQL 代码：

```sql
-- 添加项目状态 "已归档" (archived)
-- 这个迁移将修改 projects 表的 status 字段约束，添加 archived 状态

-- 删除旧的约束
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- 添加新的约束，包含 archived 状态
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'won', 'lost', 'on_hold', 'archived'));
```

6. 点击 **"Run"** 按钮执行迁移
7. 如果看到 "Success" 消息，说明迁移成功完成

### 方法二：使用迁移文件（如果可用）

如果您配置了 Supabase CLI，可以运行：

```bash
# 复制迁移文件到 Supabase migrations 目录
cp migrations/add_archived_project_status.sql supabase/migrations/

# 推送迁移到远程
supabase db push
```

## 验证迁移

执行迁移后，您可以验证是否成功：

```sql
-- 检查约束是否已更新
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'projects'
  AND n.nspname = 'public'
  AND conname = 'projects_status_check';
```

应该看到约束定义包含：`CHECK (status IN ('active', 'won', 'lost', 'on_hold', 'archived'))`

## 测试

迁移完成后，在项目管理页面中：
1. 创建或编辑一个项目
2. 在状态下拉框中应该能看到"已归档"选项
3. 选择"已归档"并保存，应该能成功保存

## 回滚（如果需要）

如果需要回滚此迁移：

```sql
-- 回滚到之前的状态
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'won', 'lost', 'on_hold'));
```

## 注意事项

- 此迁移只修改了约束，不会影响现有数据
- 现有的项目状态不会改变
- 迁移是幂等的，可以安全地重复执行
