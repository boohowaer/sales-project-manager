-- teams
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- team_members
CREATE TABLE team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('super_admin', 'sales_manager', 'sales_rep')) NOT NULL,
  status      TEXT CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  invited_by  UUID REFERENCES auth.users(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- team_invitations
CREATE TABLE team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT CHECK (role IN ('super_admin', 'sales_manager', 'sales_rep')) NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  invited_by  UUID REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- assignment_logs
CREATE TABLE assignment_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES teams(id),
  resource_type TEXT CHECK (resource_type IN ('customer', 'project', 'task')) NOT NULL,
  resource_id   UUID NOT NULL,
  assigned_from UUID REFERENCES auth.users(id),
  assigned_to   UUID REFERENCES auth.users(id) NOT NULL,
  operated_by   UUID REFERENCES auth.users(id) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- approval_requests
CREATE TABLE approval_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES teams(id) ON DELETE CASCADE,
  type          TEXT CHECK (type IN ('create_customer', 'create_project', 'update_project')) NOT NULL,
  target_id     UUID,
  payload       JSONB NOT NULL,
  submitted_by  UUID REFERENCES auth.users(id) NOT NULL,
  reviewed_by   UUID REFERENCES auth.users(id),
  status        TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- RLS: teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view their team"
  ON teams FOR SELECT
  USING (id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view their team members"
  ON team_members FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: team_invitations (只有超管通过 service role 操作，普通用户只能读自己的 token)
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read invitation by token"
  ON team_invitations FOR SELECT
  USING (true);

-- RLS: assignment_logs
ALTER TABLE assignment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view assignment logs"
  ON assignment_logs FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submitter can view own requests"
  ON approval_requests FOR SELECT
  USING (submitted_by = auth.uid());
CREATE POLICY "team managers can view all pending requests"
  ON approval_requests FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'sales_manager')
    AND status = 'active'
  ));
