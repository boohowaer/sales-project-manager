ALTER TABLE settlement_stages
  ADD COLUMN IF NOT EXISTS planned_accepted_date DATE,
  ADD COLUMN IF NOT EXISTS planned_invoiced_date DATE,
  ADD COLUMN IF NOT EXISTS planned_paid_date DATE;
