-- 每周进展表
CREATE TABLE IF NOT EXISTS weekly_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week TEXT NOT NULL,
  content TEXT NOT NULL,
  contract_signed BOOLEAN,
  settlement_accepted INTEGER DEFAULT 0,
  settlement_invoiced INTEGER DEFAULT 0,
  settlement_paid INTEGER DEFAULT 0,
  settlement_total INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_updates_project_week ON weekly_updates(project_id, week);
CREATE INDEX IF NOT EXISTS idx_weekly_updates_week ON weekly_updates(week DESC);
