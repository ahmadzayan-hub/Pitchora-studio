-- RLS checks for 0003. Runs as the `authenticated` role so policies apply. Synthetic users only.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'mallory@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.test');
grant usage on schema public to authenticated;
grant select, insert on all tables in schema public to authenticated;

create temp table ids as
  select (select default_org_id from public.users where email = 'alice@example.test') as alice_org;
grant select on ids to authenticated;

set role authenticated;

-- 1. Mallory cannot join Alice's organization.
set test.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  insert into public.memberships (user_id, org_id, role)
  values ('00000000-0000-0000-0000-00000000000b', (select alice_org from ids), 'member');
  raise exception 'FAIL: outsider joined another tenant';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  if exists (select 1 from public.sessions) then raise exception 'FAIL: sessions visible'; end if;
end $$;

-- 2. Alice (owner) can add Carol as a member; Carol cannot then promote herself.
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into public.memberships (user_id, org_id, role)
values ('00000000-0000-0000-0000-00000000000c', (select alice_org from ids), 'member');

set test.uid = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into public.memberships (user_id, org_id, role)
  values ('00000000-0000-0000-0000-00000000000c', (select alice_org from ids), 'owner');
  raise exception 'FAIL: member granted itself owner';
exception when insufficient_privilege or unique_violation then null;
end $$;

-- 3. A new organization's creator can make themselves its first owner, once.
set test.uid = '00000000-0000-0000-0000-00000000000b';
insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-0000000000f1', 'SYNTHETIC new org', 'synthetic-new-org');
insert into public.memberships (user_id, org_id, role)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1', 'owner');

-- 4. Once it has members, an outsider cannot claim it.
set test.uid = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into public.memberships (user_id, org_id, role)
  values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'owner');
  raise exception 'FAIL: claimed an organization with members';
exception when insufficient_privilege then null;
end $$;

-- 5. create_organization makes the caller its owner atomically and returns the row.
set test.uid = '00000000-0000-0000-0000-00000000000c';
do $$
declare v public.organizations;
begin
  v := public.create_organization('SYNTHETIC Carol org', 'synthetic-carol-org');
  if public.org_role(v.id) is distinct from 'owner' then raise exception 'FAIL: creator is not owner'; end if;
end $$;

reset role;
\echo membership_insert: all checks passed
