-- =============================================================================
-- Tweenz AI Learning OS — Complete Database Schema
-- Migration 0003: Full production schema
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- =============================================================================
-- USERS — extended profile beyond auth.users
-- =============================================================================
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  display_name  text,
  role          text not null default 'student' check (role in ('student','instructor','admin')),
  lang          text not null default 'en' check (lang in ('en','ar')),
  timezone      text not null default 'Asia/Dubai',
  avatar_url    text,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Coexist with the presentation/orchestrator profile created by 0001.
-- CREATE TABLE IF NOT EXISTS does not add columns to that existing table.
alter table public.users
  add column if not exists role text not null default 'student' check (role in ('student','instructor','admin')),
  add column if not exists lang text not null default 'en' check (lang in ('en','ar')),
  add column if not exists timezone text not null default 'Asia/Dubai',
  add column if not exists avatar_url text,
  add column if not exists onboarded boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Profile self-edit permission must never confer a platform role. Trusted
-- database/service provisioning remains separate from ordinary client updates.
create or replace function public.protect_tweenz_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.role is distinct from 'student')
       or (tg_op = 'UPDATE' and new.role is distinct from old.role) then
      raise exception 'platform role assignment requires trusted provisioning' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists users_protect_tweenz_role on public.users;
create trigger users_protect_tweenz_role before insert or update on public.users
  for each row execute function public.protect_tweenz_role();

-- A definer lookup avoids recursively invoking users' own RLS policy.
-- No user-supplied ID, no metadata-derived role, no public execute grant.
create or replace function public.is_tweenz_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;
revoke all on function public.is_tweenz_admin() from public;
grant execute on function public.is_tweenz_admin() to authenticated;

-- =============================================================================
-- ACADEMIC PROFILES
-- =============================================================================
create table if not exists public.academic_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  full_name         text,
  reg_number        text,
  university        text,
  mba_program       text,
  major             text,
  semester          text,
  study_mode        text check (study_mode in ('online','on_campus','hybrid')),
  target_gpa        numeric(3,2),
  weekly_study_hrs  integer,
  study_goals       text,
  exam_priorities   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =============================================================================
-- SUBSCRIPTIONS
-- =============================================================================
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.users(id) on delete cascade,
  plan                 text not null default 'free' check (plan in ('free','student','pro','instructor','org')),
  status               text not null default 'trialing' check (status in ('trialing','active','canceled','past_due','incomplete')),
  stripe_customer_id   text unique,
  stripe_sub_id        text unique,
  trial_ends_at        timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  ai_queries_used      integer not null default 0,
  ai_queries_limit     integer not null default 10,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- =============================================================================
-- PAYMENTS
-- =============================================================================
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  stripe_payment_id text unique,
  amount            integer not null, -- cents
  currency          text not null default 'usd',
  status            text not null,
  plan              text,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- COURSES
-- =============================================================================
create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  code            text,
  instructor      text,
  category        text,
  semester        text,
  status          text not null default 'active' check (status in ('active','completed','archived')),
  progress        integer not null default 0 check (progress between 0 and 100),
  starred         boolean not null default false,
  last_accessed   timestamptz,
  professor_style jsonb, -- stored style memory
  moodle_course_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists courses_user_idx on public.courses(user_id);

-- =============================================================================
-- ANNOUNCEMENTS
-- =============================================================================
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  course_id     uuid references public.courses(id) on delete set null,
  title         text not null,
  body          text,
  source        text check (source in ('manual','moodle','screenshot','paste')),
  type          text default 'general' check (type in ('academic','admin','assignment','exam','survey','urgent','general','technical')),
  summary       text,
  required_action text,
  deadline      date,
  risk_level    text default 'low' check (risk_level in ('low','medium','high','critical')),
  is_read       boolean not null default false,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists announcements_user_idx on public.announcements(user_id);
create index if not exists announcements_course_idx on public.announcements(course_id);

-- =============================================================================
-- CALENDAR EVENTS
-- =============================================================================
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  title       text not null,
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz,
  type        text default 'general' check (type in ('lecture','exam','assignment','presentation','meeting','reminder','general')),
  location    text,
  meeting_url text,
  all_day     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists calendar_events_user_idx on public.calendar_events(user_id);

-- =============================================================================
-- DEADLINES
-- =============================================================================
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  title       text not null,
  description text,
  due_date    timestamptz not null,
  type        text default 'assignment' check (type in ('assignment','quiz','exam','presentation','project','reading','lecture','admin')),
  -- risk is time-relative and is calculated on read by the API, never stored.
  is_done     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists deadlines_user_idx on public.deadlines(user_id);
create index if not exists deadlines_due_idx on public.deadlines(due_date);

-- =============================================================================
-- GRADES
-- =============================================================================
create table if not exists public.grades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  category     text not null,
  item_name    text not null,
  score        numeric(6,2),
  max_score    numeric(6,2) not null default 100,
  weight       numeric(5,2) not null default 0,
  is_final     boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists grades_course_idx on public.grades(course_id);

-- =============================================================================
-- PRIVATE FILES
-- =============================================================================
create table if not exists public.private_files (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  course_id       uuid references public.courses(id) on delete set null,
  name            text not null,
  original_name   text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  storage_path    text not null,
  status          text not null default 'uploaded' check (status in ('uploaded','processing','ready','failed','archived')),
  processing_error text,
  file_type       text check (file_type in ('pdf','pptx','docx','txt','audio','video','image','other')),
  page_count      integer,
  duration_secs   integer,
  created_at      timestamptz not null default now()
);

create index if not exists private_files_user_idx on public.private_files(user_id);
create index if not exists private_files_course_idx on public.private_files(course_id);

-- =============================================================================
-- LECTURES (file → lecture binding)
-- =============================================================================
create table if not exists public.lectures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  file_id     uuid references public.private_files(id) on delete set null,
  title       text not null,
  lecture_num integer,
  lecture_date date,
  status      text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  created_at  timestamptz not null default now()
);

create index if not exists lectures_course_idx on public.lectures(course_id);

-- =============================================================================
-- TRANSCRIPTS (extracted text)
-- =============================================================================
create table if not exists public.transcripts (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null unique references public.private_files(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  text        text not null,
  word_count  integer,
  method      text check (method in ('pdf_extract','ocr','whisper','paste','manual')),
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- DOCUMENT CHUNKS (for RAG)
-- =============================================================================
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.private_files(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  chunk_index integer not null,
  text        text not null,
  token_count integer,
  page_num    integer,
  slide_num   integer,
  created_at  timestamptz not null default now()
);

create index if not exists chunks_file_idx on public.document_chunks(file_id);
create index if not exists chunks_user_idx on public.document_chunks(user_id);

-- =============================================================================
-- EMBEDDINGS (vector store)
-- =============================================================================
create table if not exists public.embeddings (
  id        uuid primary key default gen_random_uuid(),
  chunk_id  uuid not null unique references public.document_chunks(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  embedding vector(1536),
  model     text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);

create index if not exists embeddings_user_idx on public.embeddings(user_id);

-- =============================================================================
-- STUDY PACKS
-- =============================================================================
create table if not exists public.study_packs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  course_id       uuid references public.courses(id) on delete set null,
  lecture_id      uuid references public.lectures(id) on delete set null,
  file_id         uuid references public.private_files(id) on delete set null,
  title           text not null,
  status          text not null default 'generating' check (status in ('generating','ready','failed')),
  overview        text,
  summary         text,
  detailed_notes  text,
  key_takeaways   jsonb,
  glossary        jsonb,
  mba_frameworks  jsonb,
  prof_emphasis   jsonb,
  assignments     jsonb,
  exam_prep_notes text,
  ai_model        text,
  token_count     integer,
  lang            text default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists study_packs_user_idx on public.study_packs(user_id);

-- =============================================================================
-- FLASHCARDS
-- =============================================================================
create table if not exists public.flashcards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  course_id     uuid references public.courses(id) on delete set null,
  study_pack_id uuid references public.study_packs(id) on delete cascade,
  front         text not null,
  back          text not null,
  known         boolean not null default false,
  review_count  integer not null default 0,
  last_reviewed timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists flashcards_user_idx on public.flashcards(user_id);
create index if not exists flashcards_pack_idx on public.flashcards(study_pack_id);

-- =============================================================================
-- QUIZZES
-- =============================================================================
create table if not exists public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  course_id     uuid references public.courses(id) on delete set null,
  study_pack_id uuid references public.study_packs(id) on delete set null,
  title         text not null,
  questions     jsonb not null, -- array of {question, options, correct_index, explanation}
  question_count integer not null default 0,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- QUIZ ATTEMPTS
-- =============================================================================
create table if not exists public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  answers     jsonb not null,
  score       integer not null,
  total       integer not null,
  percentage  integer not null,
  completed_at timestamptz not null default now()
);

-- =============================================================================
-- TUTOR CHATS (sessions)
-- =============================================================================
create table if not exists public.tutor_chats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tutor_chats_user_idx on public.tutor_chats(user_id);

-- =============================================================================
-- TUTOR MESSAGES
-- =============================================================================
create table if not exists public.tutor_messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.tutor_chats(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  citations   jsonb, -- [{file_name, chunk_text, page_num}]
  is_grounded boolean not null default false,
  token_count integer,
  created_at  timestamptz not null default now()
);

create index if not exists tutor_messages_chat_idx on public.tutor_messages(chat_id);

-- =============================================================================
-- WEEKLY BRIEFS
-- =============================================================================
create table if not exists public.weekly_briefs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  week_start  date not null,
  week_end    date not null,
  content     jsonb not null, -- structured brief data
  summary     text,
  lang        text default 'en',
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists weekly_briefs_user_idx on public.weekly_briefs(user_id);

-- =============================================================================
-- TASKS
-- =============================================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  title       text not null,
  description text,
  type        text default 'assignment' check (type in ('assignment','quiz','reading','presentation','project','admin','exam_prep','technical')),
  status      text not null default 'todo' check (status in ('todo','in_progress','waiting_instructor','waiting_group','submitted','completed')),
  due_date    timestamptz,
  priority    text default 'medium' check (priority in ('low','medium','high','urgent')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks(user_id);

-- =============================================================================
-- GROUP PROJECTS
-- =============================================================================
create table if not exists public.group_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  name        text not null,
  description text,
  deadline    timestamptz,
  status      text not null default 'active' check (status in ('active','submitted','completed')),
  outline     jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- GROUP MEMBERS
-- =============================================================================
create table if not exists public.group_members (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.group_projects(id) on delete cascade,
  name            text not null,
  email           text,
  role            text,
  responsibilities jsonb,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- MESSAGES CENTER
-- =============================================================================
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  from_name   text not null,
  from_email  text,
  subject     text not null,
  body        text not null,
  ai_summary  text,
  suggested_reply text,
  is_read     boolean not null default false,
  is_starred  boolean not null default false,
  type        text default 'inbox' check (type in ('inbox','sent','draft','system')),
  created_at  timestamptz not null default now()
);

create index if not exists messages_user_idx on public.messages(user_id);

-- =============================================================================
-- EMAIL DIGESTS
-- =============================================================================
create table if not exists public.email_digests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  subject     text not null,
  content     text not null,
  sent_at     timestamptz,
  status      text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- EMAIL LOGS
-- =============================================================================
create table if not exists public.email_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  to_email    text not null,
  subject     text not null,
  type        text not null,
  status      text not null,
  provider_id text,
  error       text,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- CONSENT LOGS
-- =============================================================================
create table if not exists public.consent_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  consent_type  text not null check (consent_type in ('file_upload','transcription','ai_analysis','email','live_capture','model_training','data_export')),
  granted       boolean not null,
  context       text,
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists consent_logs_user_idx on public.consent_logs(user_id);

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  action      text not null,
  resource    text,
  resource_id uuid,
  details     jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_user_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- =============================================================================
-- AI USAGE LOGS
-- =============================================================================
create table if not exists public.ai_usage_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  operation     text not null check (operation in ('study_pack','tutor_chat','quiz_gen','ask_mba','weekly_brief','announcement_analysis','embedding')),
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,6),
  success       boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_user_idx on public.ai_usage_logs(user_id);
create index if not exists ai_usage_created_idx on public.ai_usage_logs(created_at desc);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  body        text,
  type        text not null,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);

-- =============================================================================
-- DELETION REQUESTS
-- =============================================================================
create table if not exists public.deletion_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reason      text,
  status      text not null default 'pending' check (status in ('pending','processing','completed')),
  processed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- INTEGRATION CONNECTIONS
-- =============================================================================
create table if not exists public.integration_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  provider        text not null check (provider in ('moodle','google_calendar','outlook','teams','zoom','google_meet')),
  site_url        text,
  access_token_enc text, -- encrypted
  refresh_token_enc text,
  expires_at      timestamptz,
  metadata        jsonb,
  status          text not null default 'pending' check (status in ('pending','active','failed','revoked')),
  created_at      timestamptz not null default now(),
  unique (user_id, provider)
);

-- =============================================================================
-- MOODLE IMPORTS
-- =============================================================================
create table if not exists public.moodle_imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  site_name   text,
  import_type text check (import_type in ('courses','announcements','calendar','grades','files','full')),
  status      text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  items_count integer,
  errors      jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- ADMIN SETTINGS
-- =============================================================================
create table if not exists public.admin_settings (
  key   text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY — Enable on all user-data tables
-- =============================================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','academic_profiles','subscriptions','payments','courses',
    'announcements','calendar_events','deadlines','grades','private_files',
    'lectures','transcripts','document_chunks','embeddings','study_packs',
    'flashcards','quizzes','quiz_attempts','tutor_chats','tutor_messages',
    'weekly_briefs','tasks','group_projects','group_members','messages',
    'email_digests','email_logs','consent_logs','notifications',
    'deletion_requests','integration_connections','moodle_imports','ai_usage_logs'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;
end $$;

-- Users
create policy "users_own" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users_admin_read" on public.users for select using (
  public.is_tweenz_admin()
);

-- Generic user-owned tables helper function
create or replace function public.current_user_id() returns uuid as $$
  select auth.uid();
$$ language sql stable security definer;

-- Macro: each table with user_id column
create policy "academic_profiles_own" on public.academic_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Entitlements and provider customer bindings are trusted provisioning, not profile fields.
create policy "subscriptions_own_read" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "payments_own" on public.payments for select using (user_id = auth.uid());
create policy "courses_own" on public.courses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "announcements_own" on public.announcements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar_events_own" on public.calendar_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deadlines_own" on public.deadlines for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "grades_own" on public.grades for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "private_files_own" on public.private_files for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lectures_own" on public.lectures for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transcripts_own" on public.transcripts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "document_chunks_own" on public.document_chunks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "embeddings_own" on public.embeddings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "study_packs_own" on public.study_packs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "flashcards_own" on public.flashcards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quizzes_own" on public.quizzes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quiz_attempts_own" on public.quiz_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tutor_chats_own" on public.tutor_chats for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tutor_messages_own" on public.tutor_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_briefs_own" on public.weekly_briefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_own" on public.tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group_projects_own" on public.group_projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group_members_own" on public.group_members for all using (
  exists (select 1 from public.group_projects gp where gp.id = project_id and gp.user_id = auth.uid())
);
create policy "messages_own" on public.messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "email_digests_own" on public.email_digests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "email_logs_own" on public.email_logs for select using (user_id = auth.uid());
create policy "consent_logs_own" on public.consent_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deletion_requests_own" on public.deletion_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "integration_connections_own" on public.integration_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "moodle_imports_own" on public.moodle_imports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_usage_logs_own" on public.ai_usage_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin settings must actually have RLS enabled for the policies to apply.
alter table public.admin_settings enable row level security;

-- Admin access to all
create policy "admin_settings_read" on public.admin_settings for select using (true);
create policy "admin_settings_write" on public.admin_settings for all using (
  public.is_tweenz_admin()
);

-- =============================================================================
-- TRIGGERS — updated_at
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','academic_profiles','subscriptions','courses','grades',
    'study_packs','tasks','tutor_chats'
  ] loop
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      tbl, tbl
    );
  end loop;
end $$;

-- =============================================================================
-- FUNCTION: auto-create user record after signup
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_org_id uuid;
begin
  -- Keep both products' enrollment: personal workspace AND learning trial.
  -- Full UUID suffix avoids the old six-character slug collision.
  insert into public.organizations (name, slug)
  values (split_part(new.email, '@', 1) || '''s workspace', 'personal-' || new.id::text)
  returning id into new_org_id;

  insert into public.users (id, email, display_name, default_org_id)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new_org_id);
  insert into public.memberships (user_id, org_id, role)
  values (new.id, new_org_id, 'owner');
  insert into public.subscriptions (user_id, plan, status, trial_ends_at, ai_queries_limit)
  values (new.id, 'free', 'trialing', now() + interval '7 days', 10);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- FUNCTION: vector similarity search for RAG
-- =============================================================================

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_course_id uuid default null,
  match_count     integer default 8,
  match_threshold float default 0.7
)
returns table (
  chunk_id   uuid,
  file_id    uuid,
  text       text,
  page_num   integer,
  similarity float
)
language sql stable as $$
  select
    dc.id     as chunk_id,
    dc.file_id,
    dc.text,
    dc.page_num,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.document_chunks dc on dc.id = e.chunk_id
  where
    e.user_id = match_user_id
    and (match_course_id is null or dc.course_id = match_course_id)
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
