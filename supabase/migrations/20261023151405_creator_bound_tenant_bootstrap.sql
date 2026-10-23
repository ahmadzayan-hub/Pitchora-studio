-- Bind legacy two-request bootstrap to the authenticated creator, never emptiness alone.
-- Existing rows deliberately remain NULL: do not infer historical ownership.
-- Additive migration; apply only after reviewed backup and approval (see runbook).
begin;
alter table public.organizations add column creator_user_id uuid references auth.users(id) on delete set null;
alter table public.organizations alter column creator_user_id set default auth.uid();

drop policy if exists orgs_authenticated_insert on public.organizations;
create policy orgs_authenticated_insert on public.organizations for insert to authenticated
  with check (auth.uid() is not null and creator_user_id = auth.uid());

create function public.can_bootstrap_org(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o
    where o.id = target_org and o.creator_user_id = auth.uid())
    and not exists (select 1 from public.memberships m where m.org_id = target_org);
$$;
revoke all on function public.can_bootstrap_org(uuid) from public;
grant execute on function public.can_bootstrap_org(uuid) to authenticated;

drop policy if exists memberships_self_insert on public.memberships;
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'owner' and public.can_bootstrap_org(org_id))
    or public.org_role(org_id) = 'owner'
    or (public.org_role(org_id) = 'admin' and role = 'member')
  );

-- Preferred path: atomic creation leaves no orphan if either insert fails.
-- Existing signup trigger and legacy INSERT-without-RETURNING clients remain valid.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare new_org public.organizations;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  insert into public.organizations (name, slug, creator_user_id)
    values (p_name, p_slug, auth.uid()) returning * into new_org;
  insert into public.memberships (user_id, org_id, role)
    values (auth.uid(), new_org.id, 'owner');
  return new_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
commit;
