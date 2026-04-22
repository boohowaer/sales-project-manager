-- ================================================================
-- 修复 team_members RLS 无限递归问题
-- 原因：team_members 的 SELECT 策略查询了自身，造成死循环
-- 方案：创建 SECURITY DEFINER 函数绕过 RLS，所有策略改用该函数
-- ================================================================

-- Step 1: 创建绕过 RLS 的辅助函数
-- SECURITY DEFINER 使函数以定义者（超管）身份执行，不触发 RLS
CREATE OR REPLACE FUNCTION public.get_my_team_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_team_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM team_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

-- Step 2: 修复 team_members 自身的 RLS 策略（根源）
DROP POLICY IF EXISTS "team members can view their team members" ON team_members;
CREATE POLICY "team members can view their team members"
  ON team_members FOR SELECT
  USING (team_id = public.get_my_team_id());

-- Step 3: 修复 teams 表策略
DROP POLICY IF EXISTS "team members can view their team" ON teams;
CREATE POLICY "team members can view their team"
  ON teams FOR SELECT
  USING (id = public.get_my_team_id());

-- Step 4: 修复 customers 表策略
DROP POLICY IF EXISTS "Users can see own or team customers" ON customers;
CREATE POLICY "Users can see own or team customers"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id = public.get_my_team_id())
  );

-- Step 5: 修复 projects 表策略
DROP POLICY IF EXISTS "Users can see own or team projects" ON projects;
CREATE POLICY "Users can see own or team projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id = public.get_my_team_id())
  );

-- Step 6: 修复 tasks 表策略
DROP POLICY IF EXISTS "Users can see own or team tasks" ON tasks;
CREATE POLICY "Users can see own or team tasks"
  ON tasks FOR SELECT
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id = public.get_my_team_id())
  );

-- Step 7: 修复 assignment_logs 表策略
DROP POLICY IF EXISTS "team members can view assignment logs" ON assignment_logs;
CREATE POLICY "team members can view assignment logs"
  ON assignment_logs FOR SELECT
  USING (team_id = public.get_my_team_id());

-- Step 8: 修复 approval_requests 表策略
DROP POLICY IF EXISTS "team managers can view all pending requests" ON approval_requests;
CREATE POLICY "team managers can view all pending requests"
  ON approval_requests FOR SELECT
  USING (
    team_id = public.get_my_team_id()
    AND public.get_my_team_role() IN ('super_admin', 'sales_manager')
  );
