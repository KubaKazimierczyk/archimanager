-- ============================================================
-- ArchiManager — Addendum: add columns introduced after initial setup
-- Run this in Supabase SQL Editor on an existing database
-- (safe to run multiple times — uses IF NOT EXISTS / DO blocks)
-- ============================================================

-- 1. completed_tasks column in milestones (for interactive Timeline checkboxes)
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS completed_tasks JSONB DEFAULT '[]';

-- 2. provider column in application_history (for ML provider weighting)
ALTER TABLE application_history
  ADD COLUMN IF NOT EXISTS provider TEXT;

-- 3. filed_month column in application_history (for seasonality analysis)
--    May already exist — safe if already added
ALTER TABLE application_history
  ADD COLUMN IF NOT EXISTS filed_month INTEGER;

-- 4. Update the DB trigger to also capture provider from plot JSONB
CREATE OR REPLACE FUNCTION log_application_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DONE' AND NEW.actual_days IS NOT NULL AND (OLD.status IS DISTINCT FROM 'DONE') THEN
    INSERT INTO application_history (user_id, type, actual_days, municipality, provider, filed_month)
    SELECT
      p.user_id,
      NEW.type,
      NEW.actual_days,
      (p.client->>'city')::TEXT,
      CASE WHEN NEW.type = 'ZJAZD' THEN (p.plot->>'road_class')::TEXT ELSE NULL END,
      EXTRACT(MONTH FROM NEW.filed_date)::INTEGER
    FROM projects p
    WHERE p.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (if it already exists under a different name, run the DROP first)
-- DROP TRIGGER IF EXISTS application_completed ON applications;
-- DROP TRIGGER IF EXISTS application_done_trigger ON applications;
CREATE OR REPLACE TRIGGER application_completed
  AFTER UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION log_application_completion();
