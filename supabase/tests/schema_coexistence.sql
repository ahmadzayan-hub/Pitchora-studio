-- Synthetic identities, isolated PostgreSQL only. Never a production smoke test.
begin;
set row_security = on;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
create function pg_temp.must_deny(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege then return; end;
  raise exception 'EXPECTED DENIAL: %', statement;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('81111111-1111-4111-8111-111111111111','alice@example.invalid','{"full_name":"Alice", "role":"admin"}'),
 ('82222222-2222-4222-8222-222222222222','bob@example.invalid','{}'),
 ('83333333-3333-4333-8333-333333333333','administrator@example.invalid','{}');
select pg_temp.check_true((select count(*)=3 from public.users where id::text like '8%'),'signup creates profiles');
select pg_temp.check_true((select count(*)=3 from public.subscriptions where user_id::text like '8%'),'signup retains learning trials');
select pg_temp.check_true((select count(*)=3 from public.users u join public.memberships m on m.org_id=u.default_org_id and m.user_id=u.id where u.id::text like '8%' and m.role='owner'),'signup retains personal owner workspaces');
select pg_temp.check_true((select role='student' and display_name='Alice' from public.users where email='alice@example.invalid'),'metadata cannot grant platform admin');
-- A rejected signup must not leave an orphan workspace or partial profile.
do $$ declare n bigint; begin
 select count(*) into n from public.organizations;
 begin
   insert into auth.users(id,email) values ('84444444-4444-4444-8444-444444444444',null);
   raise exception 'NULL email signup unexpectedly accepted';
 exception when not_null_violation then null;
 end;
 perform pg_temp.check_true((select count(*)=n from public.organizations),'failed signup rolls back workspace');
 perform pg_temp.check_true(not exists(select 1 from public.users where id='84444444-4444-4444-8444-444444444444'),'failed signup rolls back profile');
end $$;
-- Existing trusted provisioning is tested; no application grant path is added.
update public.users set role='admin' where id='83333333-3333-4333-8333-333333333333';
insert into public.courses(id,user_id,name) values
 ('81111111-aaaa-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','Alice course'),
 ('82222222-aaaa-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','Bob course');
insert into public.deadlines(id,user_id,course_id,title,due_date) values
 ('81111111-bbbb-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','81111111-aaaa-4111-8111-111111111111','Alice private deadline','2030-01-01T12:00:00Z'),
 ('82222222-bbbb-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','82222222-aaaa-4222-8222-222222222222','Bob private deadline','2030-01-02T12:00:00Z');
select pg_temp.check_true(not exists(select 1 from pg_attribute where attrelid='public.deadlines'::regclass and attname='risk' and attgenerated<>''),'deadline risk never uses immutable time fiction');
grant select,insert,update,delete on all tables in schema public to authenticated;
set role authenticated;
set test.uid='81111111-1111-4111-8111-111111111111';
select pg_temp.check_true(row_security_active('public.users') and row_security_active('public.deadlines'),'RLS really active');
select pg_temp.check_true((select count(*)=1 from public.users),'profile SELECT has no recursive RLS or cross-user leak');
select pg_temp.check_true(not public.is_tweenz_admin(),'ordinary user is not platform admin');
select pg_temp.check_true((select count(*)=1 from public.subscriptions),'own subscription remains readable');
with changed as (update public.subscriptions set plan='pro',ai_queries_limit=999999,stripe_customer_id='cus_synthetic_other' where user_id=auth.uid() returning id) select pg_temp.check_true(count(*)=0,'client cannot assign entitlements or provider identity') from changed;
with changed as (delete from public.subscriptions where user_id=auth.uid() returning id) select pg_temp.check_true(count(*)=0,'client cannot delete billing linkage') from changed;
select pg_temp.must_deny($q$insert into public.subscriptions(user_id,plan,ai_queries_limit,stripe_customer_id) values(auth.uid(),'pro',999999,'cus_synthetic_other') on conflict(user_id) do update set plan=excluded.plan$q$);
select pg_temp.check_true((select plan='free' and ai_queries_limit=10 and stripe_customer_id is null from public.subscriptions where user_id=auth.uid()),'trial entitlement remains unchanged');
update public.users set display_name='Updated',lang='ar',timezone='Asia/Dubai' where id=auth.uid();
select pg_temp.check_true((select display_name='Updated' and lang='ar' from public.users where id=auth.uid()),'ordinary profile preferences remain editable');
select pg_temp.must_deny($q$update public.users set role='admin' where id=auth.uid()$q$);
select pg_temp.must_deny($q$update public.users set role='instructor' where id=auth.uid()$q$);
select pg_temp.must_deny($q$insert into public.users(id,email,role) values(auth.uid(),'upsert@example.invalid','admin') on conflict(id) do update set role=excluded.role$q$);
select pg_temp.must_deny($q$insert into public.admin_settings(key,value) values('forbidden','{}')$q$);
select pg_temp.check_true((select count(*)=1 from public.deadlines),'deadline reads isolate users');
with changed as (update public.deadlines set title='hijacked' where user_id='82222222-2222-4222-8222-222222222222' returning id) select pg_temp.check_true(count(*)=0,'foreign update denied') from changed;
select pg_temp.must_deny($q$insert into public.deadlines(user_id,title,due_date) values('82222222-2222-4222-8222-222222222222','forged','2030-01-01')$q$);
update public.deadlines set is_done=true where id='81111111-bbbb-4111-8111-111111111111';
select pg_temp.check_true((select is_done from public.deadlines where id='81111111-bbbb-4111-8111-111111111111'),'deadline completion persists');
set test.uid='83333333-3333-4333-8333-333333333333';
select pg_temp.check_true(public.is_tweenz_admin(),'trusted assigned admin recognized');
select pg_temp.check_true((select count(*)>=3 from public.users),'admin read intended without recursion');
insert into public.admin_settings(key,value) values('synthetic_setting','{}');
-- A platform admin cannot silently change roles through the normal client either.
select pg_temp.must_deny($q$update public.users set role='student' where id=auth.uid()$q$);
reset role;
select 'SCHEMA_COEXISTENCE_PASS' as result;
rollback;
