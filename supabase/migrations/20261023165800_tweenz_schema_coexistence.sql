-- Apply only to a reviewed existing schema after backup and release approval.
-- Fresh installations also replay corrected 0003, whose original generated
-- now() expression could never complete on PostgreSQL. Do not mark an old
-- partially-applied migration as complete without schema reconciliation.
begin;
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

drop policy if exists users_admin_read on public.users;
create policy users_admin_read on public.users for select to authenticated
  using (public.is_tweenz_admin());
alter table public.admin_settings enable row level security;
drop policy if exists admin_settings_write on public.admin_settings;
create policy admin_settings_write on public.admin_settings for all to authenticated
  using (public.is_tweenz_admin()) with check (public.is_tweenz_admin());

-- Preserve read access, but never let a normal client assign a billing customer,
-- paid plan, query allowance or usage reset. Existing service webhook writes
-- continue through their trusted role; no entitlement values are rewritten.
drop policy if exists subscriptions_own on public.subscriptions;
drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

-- Preserve any legacy manually-created risk column and its values. The new API
-- never reads or writes it; no destructive column rewrite or stale trigger.
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

-- Retain the GPA-scale preference already collected by the existing form.
alter table public.academic_profiles add column if not exists gpa_scale numeric
  check (gpa_scale in (4, 100));

-- Authenticated invoker: normal RLS remains active and ownership cannot be
-- supplied by the caller. Both profile changes succeed or roll back together.
create or replace function public.complete_tweenz_onboarding(
  p_full_name text, p_program_name text, p_university text, p_gpa_scale numeric,
  p_study_hours integer, p_primary_language text, p_goal text
) returns void language plpgsql security invoker set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 1 and 200
     or p_program_name is null or length(btrim(p_program_name)) not between 1 and 200
     or p_university is null or length(p_university)>200
     or p_gpa_scale is null or p_gpa_scale not in (4,100)
     or p_study_hours is null or p_study_hours not between 0 and 168
     or p_primary_language is null or p_primary_language not in ('en','ar')
     or p_goal is null or p_goal not in ('gpa','skills','career','research') then
    raise exception 'invalid onboarding input' using errcode = '22023';
  end if;
  update public.users set display_name=btrim(p_full_name),lang=p_primary_language,onboarded=true
    where id=caller;
  if not found then raise exception 'profile unavailable' using errcode = '42501'; end if;
  insert into public.academic_profiles(user_id,full_name,mba_program,university,gpa_scale,weekly_study_hrs,study_goals)
  values(caller,btrim(p_full_name),btrim(p_program_name),btrim(p_university),p_gpa_scale,p_study_hours,p_goal)
  on conflict(user_id) do update set full_name=excluded.full_name,mba_program=excluded.mba_program,
    university=excluded.university,gpa_scale=excluded.gpa_scale,weekly_study_hrs=excluded.weekly_study_hrs,
    study_goals=excluded.study_goals;
end;
$$;
revoke all on function public.complete_tweenz_onboarding(text,text,text,numeric,integer,text,text) from public;
grant execute on function public.complete_tweenz_onboarding(text,text,text,numeric,integer,text,text) to authenticated;

commit;
