-- ArchiManager Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROJECTS ─────────────────────────────────────────────
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  status text default 'active' check (status in ('active', 'archived', 'completed')),
  client jsonb not null default '{}',
  plot jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

-- ─── APPLICATIONS (WNIOSKI) ──────────────────────────────
create table public.applications (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  type text not null check (type in ('ZJAZD', 'WOD_KAN', 'ENERGIA', 'ADAPTACJA')),
  status text default 'TODO' check (status in ('TODO', 'IN_PROGRESS', 'WAITING', 'DONE', 'BLOCKED')),
  filed_date date,
  response_date date,
  actual_days integer,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── MILESTONES ──────────────────────────────────────────
create table public.milestones (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  milestone_id text not null,
  status text default 'TODO' check (status in ('TODO', 'IN_PROGRESS', 'DONE')),
  completed_date date,
  created_at timestamptz default now()
);

-- ─── APPLICATION HISTORY (ML training data) ──────────────
create table public.application_history (
  id uuid default uuid_generate_v4() primary key,
  type text not null,
  actual_days integer not null,
  municipality text,
  season text,
  has_mpzp boolean,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now()
);

-- ─── INDEXES ─────────────────────────────────────────────
create index idx_applications_project on public.applications(project_id);
create index idx_milestones_project on public.milestones(project_id);
create index idx_history_type on public.application_history(type);
create index idx_projects_user on public.projects(user_id);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on public.projects
  for each row execute function update_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function update_updated_at();

-- ─── AUTO-ADD TO HISTORY ON APPLICATION DONE ─────────────
create or replace function add_to_history()
returns trigger as $$
begin
  if new.status = 'DONE' and new.actual_days is not null and
     (old.status is distinct from 'DONE') then
    insert into public.application_history (type, actual_days, municipality, project_id)
    select new.type, new.actual_days,
           (p.client->>'city'),
           new.project_id
    from public.projects p where p.id = new.project_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger application_done_trigger after update on public.applications
  for each row execute function add_to_history();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────
alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.milestones enable row level security;
alter table public.application_history enable row level security;

-- Policies: users can only access their own data
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can create projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

create policy "Users can manage own applications" on public.applications
  for all using (project_id in (select id from public.projects where user_id = auth.uid()));

create policy "Users can manage own milestones" on public.milestones
  for all using (project_id in (select id from public.projects where user_id = auth.uid()));

create policy "Users can view own history" on public.application_history
  for select using (project_id in (select id from public.projects where user_id = auth.uid()));

-- ─── STORAGE BUCKET FOR MPZP FILES ──────────────────────
-- Run separately in Supabase Dashboard > Storage:
-- Create bucket "project-files" with public access disabled
