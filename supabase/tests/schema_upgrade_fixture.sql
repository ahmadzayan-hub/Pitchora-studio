-- Disposable, representative manually-reconciled legacy schema only.
-- This is NOT a script to downgrade an actual database.
alter table public.deadlines add column risk text;
drop trigger users_protect_tweenz_role on public.users;
drop policy subscriptions_own_read on public.subscriptions;
create policy subscriptions_own on public.subscriptions for all using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.admin_settings disable row level security;
drop policy users_admin_read on public.users;
create policy users_admin_read on public.users for select using (
  exists(select 1 from public.users u where u.id=auth.uid() and u.role='admin'));
insert into auth.users(id,email) values ('91111111-1111-4111-8111-111111111111','legacy@example.invalid');
update public.users set role='instructor',lang='ar',display_name='Existing profile' where id='91111111-1111-4111-8111-111111111111';
insert into public.deadlines(user_id,title,due_date,risk,is_done) values ('91111111-1111-4111-8111-111111111111','Existing deadline','2020-01-01','safe',true);
insert into public.pq_organizations(id,name,slug) values ('91111111-aaaa-4111-8111-111111111111','Existing presentation org','legacy-presentation');
insert into public.pq_presentation_projects(id,organization_id,owner_id,title) values ('91111111-bbbb-4111-8111-111111111111','91111111-aaaa-4111-8111-111111111111','91111111-1111-4111-8111-111111111111','Existing deck');
insert into public.pq_deck_versions(organization_id,project_id,version_number,pptx_path) values ('91111111-aaaa-4111-8111-111111111111','91111111-bbbb-4111-8111-111111111111',1,'synthetic/retained.pptx');
create table public.test_preservation_snapshot(table_name text, contents jsonb);
do $$ declare t text; begin
 foreach t in array array['users','organizations','memberships','subscriptions','deadlines','pq_organizations','pq_presentation_projects','pq_deck_versions'] loop
  execute format('insert into public.test_preservation_snapshot select %L, coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from public.%I x',t,t);
 end loop;
end $$;

-- Restore the old learning-only trigger body to independently verify that the
-- additive upgrade reinstates both products' atomic signup behavior.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.users(id,email,display_name) values(new.id,new.email,split_part(new.email,'@',1));
 insert into public.subscriptions(user_id,plan,status) values(new.id,'free','trialing');
 return new;
end $$;
