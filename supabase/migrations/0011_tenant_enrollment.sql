-- Tenant enrollment: close the tenant-escape in memberships_self_insert (0001) and
-- create an organization with its owner membership in one step.
--
-- 0001 allowed any signed-in user to insert a membership for themselves into ANY
-- organization (with check user_id = auth.uid()), with any role. is_org_member()
-- then granted that user every session, template, answer, prompt version and API
-- key of the organization they joined.
--
-- Memberships are now created only by:
--   * the signup trigger handle_new_user() (security definer, unaffected by RLS);
--   * a self-insert as 'owner' into an organization that has no members yet
--     (the creator of a new organization);
--   * an owner or admin of the organization adding someone else; only an owner
--     may grant 'owner' or 'admin'.
--
-- Rollback (re-opens the defect; do not use in production):
--   drop policy memberships_insert on public.memberships;
--   create policy memberships_self_insert on public.memberships for insert with check (user_id = auth.uid());

create or replace function public.org_role(target_org uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select m.role from public.memberships m
  where m.org_id = target_org and m.user_id = auth.uid();
$$;

create or replace function public.org_has_members(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.memberships m where m.org_id = target_org);
$$;

revoke all on function public.org_role(uuid) from public;
revoke all on function public.org_has_members(uuid) from public;
grant execute on function public.org_role(uuid) to authenticated;
grant execute on function public.org_has_members(uuid) to authenticated;

drop policy if exists memberships_self_insert on public.memberships;
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (
    (user_id = auth.uid() and role = 'owner' and not public.org_has_members(org_id))
    or (public.org_role(org_id) = 'owner')
    or (public.org_role(org_id) = 'admin' and role = 'member')
  );

-- Organization creation in one step. The previous flow inserted the organization with
-- RETURNING, which RLS refuses (the creator is not yet a member, so the row is not
-- readable), and then inserted the membership with its error ignored.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.organizations (name, slug) values (p_name, p_slug) returning * into v_org;
  insert into public.memberships (user_id, org_id, role) values (auth.uid(), v_org.id, 'owner');
  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
