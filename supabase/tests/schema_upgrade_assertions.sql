-- The additive repair must not rewrite existing records, roles or artifact links.
begin;
create function pg_temp.upgrade_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'UPGRADE ASSERTION: %',label; end if; end $$;
do $$ declare r record; actual jsonb; begin
 for r in select * from public.test_preservation_snapshot loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from public.%I x',r.table_name) into actual;
  perform pg_temp.upgrade_assert(actual=r.contents,r.table_name||' unchanged byte-equivalent JSON');
 end loop;
end $$;
select pg_temp.upgrade_assert((select risk='safe' and is_done from public.deadlines where user_id='91111111-1111-4111-8111-111111111111'),'legacy risk retained but no longer authoritative');
grant select,update,insert on all tables in schema public to authenticated;
set role authenticated;
set test.uid='91111111-1111-4111-8111-111111111111';
select pg_temp.upgrade_assert((select role='instructor' and lang='ar' from public.users where id=auth.uid()),'existing role is not guessed or reset');
select pg_temp.upgrade_assert(row_security_active('public.admin_settings'),'upgrade enables admin settings RLS');
do $$ begin
 begin update public.users set role='admin' where id=auth.uid(); raise exception 'role escalation accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.admin_settings(key,value) values('forbidden-upgrade','{}'); raise exception 'admin write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'SCHEMA_UPGRADE_PASS' as result;
rollback;
