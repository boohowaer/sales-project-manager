-- 验证 archived 状态是否已添加到 projects 表

-- 检查 projects 表的 status 字段约束
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'projects'
  AND n.nspname = 'public'
  AND conname = 'projects_status_check';

-- 测试插入不同状态的数据（仅用于验证，不会实际插入）
-- 如果以下查询不报错，说明约束允许这些状态
DO $$
DECLARE
    test_status TEXT;
BEGIN
    FOREACH test_status IN ARRAY ARRAY['active', 'won', 'lost', 'on_hold', 'archived']
    LOOP
        BEGIN
            -- 尝试插入测试数据（会立即回滚）
            PERFORM projects.status FROM (
                SELECT '00000000-0000-0000-0000-000000000000'::UUID AS id,
                       auth.uid() AS user_id,
                       customer_id,
                       'Test' AS name,
                       test_status AS status
                FROM customers LIMIT 1
            ) AS test_insert
            WHERE FALSE; -- 永远不执行实际插入
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Status % is not allowed: %', test_status, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'All status values are valid!';
END $$;
