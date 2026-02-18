-- ============================================================
-- ArchiManager — Supabase Database Schema
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROJECTS ────────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  client JSONB NOT NULL DEFAULT '{}',
  plot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPLICATIONS (WNIOSKI) ──────────────────────────────────
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ZJAZD', 'WOD_KAN', 'ENERGIA', 'ADAPTACJA')),
  status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'WAITING', 'DONE', 'BLOCKED')),
  filed_date DATE,
  response_date DATE,
  actual_days INTEGER,
  notes TEXT DEFAULT '',
  generated_file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MILESTONES ──────────────────────────────────────────────
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id TEXT NOT NULL, -- m1, m2, m3, m4
  status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, milestone_id)
);

-- ── APPLICATION HISTORY (ML TRAINING DATA) ──────────────────
-- Populated automatically when an application is marked DONE
CREATE TABLE application_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  actual_days INTEGER NOT NULL,
  municipality TEXT,
  filed_month INTEGER, -- 1-12 for seasonality analysis
  had_supplements BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MPZP FILES ──────────────────────────────────────────────
CREATE TABLE mpzp_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- path in Supabase Storage
  file_size INTEGER,
  parsed_data JSONB DEFAULT '{}', -- AI-extracted MPZP parameters
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_applications_project ON applications(project_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_type ON applications(type);
CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_history_type ON application_history(type);
CREATE INDEX idx_history_municipality ON application_history(municipality);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpzp_files ENABLE ROW LEVEL SECURITY;

-- Projects: users can only see their own
CREATE POLICY "Users see own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Applications: through project ownership
CREATE POLICY "Users manage own applications"
  ON applications FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Milestones: through project ownership
CREATE POLICY "Users manage own milestones"
  ON milestones FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- History: users see own data, insert own
CREATE POLICY "Users see own history"
  ON application_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own history"
  ON application_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- MPZP files: through project ownership
CREATE POLICY "Users manage own mpzp files"
  ON mpzp_files FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- ── TRIGGER: auto-update updated_at ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TRIGGER: auto-populate history on application DONE ──────
CREATE OR REPLACE FUNCTION log_application_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DONE' AND NEW.actual_days IS NOT NULL AND (OLD.status IS DISTINCT FROM 'DONE') THEN
    INSERT INTO application_history (user_id, type, actual_days, municipality, filed_month)
    SELECT
      p.user_id,
      NEW.type,
      NEW.actual_days,
      (p.client->>'city')::TEXT,
      EXTRACT(MONTH FROM NEW.filed_date)::INTEGER
    FROM projects p
    WHERE p.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER application_completed
  AFTER UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION log_application_completion();

-- ── STORAGE BUCKET ──────────────────────────────────────────
-- Run separately in Supabase Dashboard > Storage:
-- Create bucket "project-files" with public access disabled
-- Or use SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
