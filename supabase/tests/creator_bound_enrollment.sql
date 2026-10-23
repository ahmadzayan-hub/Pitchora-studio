-- Run only in an isolated database with tests/stub.sql and the tenant migration chain.
-- Authentication claims are synthetic; this is RLS evidence, not hosted sign-in evidence.
begin;
set row_security = on;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','tenant-alice@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','tenant-bob@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','tenant-admin@example.invalid'),
 ('44444444-4444-4444-8444-444444444444','tenant-member@example.invalid'),
 ('55555555-5555-4555-8555-555555555555','tenant-invite@example.invalid');
insert into public.organizations(id,name,slug) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tenant A','regression-a'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Tenant B','regression-b'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Historical orphan','regression-orphan');
insert into public.memberships(user_id,org_id,role) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','member');
insert into public.sessions(id,org_id,user_id,raw_prompt) values
 ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Tenant A private evidence'),
 ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Tenant B private evidence');
insert into public.templates(org_id,name,body) select id, name, '{}'::jsonb from public.organizations where slug in ('regression-a','regression-b');
insert into public.questions(id,session_id,org_id,position,question) select id,id,org_id,1,'Private question' from public.sessions;
insert into public.answers(question_id,session_id,org_id,answer) select id,session_id,org_id,'Private answer' from public.questions;
insert into public.prompt_versions(session_id,org_id,version,final_prompt) select id,org_id,1,'Private version' from public.sessions;
insert into public.api_keys(org_id,user_id,name,key_hash) select org_id,user_id,'Synthetic non-secret','not-a-real-key' from public.sessions;
grant select,insert,update,delete on all tables in schema public to authenticated;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
create function pg_temp.expect_rls_denial(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege then return; end;
  raise exception 'EXPECTED RLS DENIAL: %', statement;
end $$;
set role authenticated;
set test.uid = '22222222-2222-4222-8222-222222222222';
select pg_temp.assert_true(current_user = 'authenticated' and not (select rolsuper or rolbypassrls from pg_roles where rolname=current_user), 'tests run as non-bypass role');
select pg_temp.assert_true(row_security_active('public.memberships') and row_security_active('public.sessions'), 'RLS is active in this execution mode');
-- First test detects the merged empty-org takeover before the repair is applied.
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values(auth.uid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','owner')$q$);
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner')$q$);
-- All six tenant tables contain real rows in both tenants; reads must retain B and hide A.
do $$ declare t text; n int; begin
 foreach t in array array['sessions','templates','questions','answers','prompt_versions','api_keys'] loop
  execute format('select count(*) from public.%I',t) into n;
  perform pg_temp.assert_true(n=1, t || ': exactly the own-tenant row is visible');
  execute format('select count(*) from public.%I where org_id=%L',t,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') into n;
  perform pg_temp.assert_true(n=0,t || ': tenant A is hidden');
 end loop;
end $$;
with changed as (update public.sessions set raw_prompt='hijacked' where org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id) select pg_temp.assert_true(count(*)=0,'cross-tenant UPDATE does not touch rows') from changed;
with changed as (delete from public.sessions where org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id) select pg_temp.assert_true(count(*)=0,'cross-tenant DELETE does not touch rows') from changed;
select pg_temp.expect_rls_denial($q$insert into public.sessions(org_id,user_id,raw_prompt) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'forbidden')$q$);
set test.uid = '44444444-4444-4444-8444-444444444444';
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','member')$q$);
with changed as (update public.memberships set role='owner' where user_id=auth.uid() and org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id) select pg_temp.assert_true(count(*)=0,'member cannot UPDATE own role') from changed;
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner') on conflict(user_id,org_id) do update set role=excluded.role$q$);
set test.uid = '33333333-3333-4333-8333-333333333333';
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin')$q$);
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner')$q$);
insert into public.memberships(user_id,org_id,role) values('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','member');
select pg_temp.assert_true((select role='member' from public.memberships where user_id='55555555-5555-4555-8555-555555555555' and org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'admin can invite member');
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','member') on conflict(user_id,org_id) do update set role='owner'$q$);
set test.uid = '11111111-1111-4111-8111-111111111111';
insert into public.memberships(user_id,org_id,role) values('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin');
-- Compatibility: authenticated creator can use the old two-request bootstrap WITHOUT RETURNING.
insert into public.organizations(id,name,slug) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Legacy client','regression-legacy');
set test.uid = '22222222-2222-4222-8222-222222222222';
select pg_temp.expect_rls_denial($q$insert into public.memberships(user_id,org_id,role) values(auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner')$q$);
select pg_temp.expect_rls_denial($q$insert into public.organizations(name,slug,creator_user_id) values('Spoofed creator','regression-spoof','11111111-1111-4111-8111-111111111111')$q$);
set test.uid = '11111111-1111-4111-8111-111111111111';
insert into public.memberships(user_id,org_id,role) values(auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner');
select pg_temp.assert_true((select creator_user_id=auth.uid() from public.organizations where slug='regression-legacy'),'creator is bound and owner can read');
do $$ declare o public.organizations; n int; begin
 o:=public.create_organization('Atomic','regression-atomic');
 perform pg_temp.assert_true(o.creator_user_id=auth.uid() and public.org_role(o.id)='owner','RPC creates owned organization');
 select count(*) into n from public.organizations;
 begin perform public.create_organization('Duplicate','regression-atomic'); raise exception 'duplicate slug accepted'; exception when unique_violation then null; end;
 perform pg_temp.assert_true((select count(*)=n from public.organizations),'failed duplicate RPC leaves no orphan');
end $$;
set test.uid = '';
do $$ begin
 begin perform public.create_organization('Unauthenticated','regression-no-auth'); raise exception 'unauthenticated RPC accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.memberships where org_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),'historical orphan stays unclaimed');
select pg_temp.assert_true((select raw_prompt='Tenant A private evidence' from public.sessions where org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'foreign evidence unchanged');
select 'TENANT_REGRESSION_PASS' as result;
rollback;
