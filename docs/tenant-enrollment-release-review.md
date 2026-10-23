# Creator-bound tenant enrollment release review

## Scope and behavior
Additive migration: `supabase/migrations/20261023151405_creator_bound_tenant_bootstrap.sql`. Earlier tenant PRs were already merged; this is a follow-up, not a competing rewrite.

An empty organization is NOT proof of ownership. Existing organizations deliberately retain NULL creator_user_id; neither a known UUID nor knowing that an organization is empty permits ownership. No historical creator is guessed and no data is deleted.

New authenticated INSERTs default creator_user_id to auth.uid(), and RLS rejects a different or NULL creator. The existing two-request legacy flow remains supported only for that creator (INSERT without RETURNING, then owner membership). INSERT ... RETURNING before membership remains hidden by SELECT RLS; clients needing a returned organization must call create_organization(name, slug), which atomically creates both rows. The three existing /api/orgs routes already call this RPC. PromptOps uses the signup trigger and has no organizations INSERT caller in current src/utils. The signup trigger remains intact.

Existing owners may invite owner/admin/member; existing admins only member. UPDATE remains default-deny; upserts cannot elevate roles. No additional table grants, credentials, hosted settings or production policy changes were applied by this PR.

## Reproducible evidence
Run `python3 scripts/test-tenant-rls.py --pg-bin /path/to/postgresql/bin`.

Tested with official Debian PostgreSQL 17.11, isolated single-user clusters, no listening server. The runner explicitly reserves normal-object OIDs and asserts row_security_active plus a non-superuser/non-BYPASSRLS authenticated role. It fails closed on SQL errors even when the stand-alone backend exits zero.

- The exact merged baseline reproduces a known orphan UUID takeover (expected regression failure).
- The repair passes real PostgreSQL RLS tests with populated tenants A/B in sessions, templates, questions, answers, prompt_versions and api_keys.
- Foreign tenant reads/writes/deletes denied; own tenant evidence still visible.
- Owner/admin/member invitation boundaries and member/admin UPDATE/upsert escalation denied.
- Non-creator cannot bootstrap a creator-bound empty organization; creator can finish a legitimate legacy flow.
- Atomic RPC succeeds, rejects unauthenticated calls and duplicate slugs without leaving an orphan.

NOT PASSING: complete migration replay stops in the inherited 0003_tweenz_schema.sql with PostgreSQL error "generation expression is not immutable". This change intentionally does not rewrite the Tweenz/PresentIQ architecture. The focused shared tenant chain excludes those independent schemas; production upgrade compatibility must be verified from the actual schema snapshot.

`python3 scripts/test-tenant-rls.py --pg-bin /path/to/postgresql/bin --full-chain` additionally replays every migration. This is a separate release gate, not silently included in the focused CI success.

`python3 scripts/test-tenant-concurrency.py` supplies multi-session creator/outsider, double-submit and duplicate-slug races on a disposable local server. Requires TEST_DATABASE_IS_DISPOSABLE=1, local PGHOST, PGDATABASE=tenant_test_*, psql and the initialized tenant chain. It has NOT been executed here: sandbox denied Unix-socket creation. No alternate listener was opened. Run it before release on an approved local/CI PostgreSQL server. Hosted identity/PostgREST JWT enforcement, actual deployment schema, real-client sign-in and live migration remain UNVERIFIED. SQL fixture identity is not evidence of hosted authentication.

## Approval-gated migration plan
Do not merge, deploy or apply this SQL to a live database without owner approval.
1. Read-only: confirm actual project, database, migration ledger and affected deployed branch/SHA. Review current policies on organizations and memberships (including any permissive extra INSERT/ALL policy), role grants, create_organization/sign-up trigger definition and orphan organization counts. An additional permissive policy may bypass this repair and requires separate review.
2. Use existing backup facilities for an encrypted schema/data backup of organizations, memberships, users/auth relationships and migration ledger; record backup ID/time. Restore into an isolated test database and prove recovery before production writes. Do not copy keys or auth tokens into reports.
3. Replay the actual schema plus this migration in that isolated database, then run RLS, concurrent tests and authenticated real-client onboarding. Verify existing tenants and legacy clients. Resolve the full-chain blocker where applicable. Do not assign owners to historical orphans automatically; require verified owner evidence.
4. After explicit approval, apply this one migration transaction using the existing reviewed migration mechanism. ALTER TABLE takes a lock; schedule an appropriate maintenance window. Verify row counts unchanged, historical creator fields remain NULL, expected new policies present, and synthetic isolated acceptance passes. Preserve rollback backup until acceptance.

## Fail-closed rollback
If legacy bootstrap causes a regression, keep the creator column and data. Preserve atomic create_organization and deny direct self-bootstrap rather than reverting to the merged vulnerable policy. Review and approve this containment SQL separately:

```sql
begin;
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.org_role(org_id) = 'owner'
    or (public.org_role(org_id) = 'admin' and role = 'member'));
commit;
```

This disables only legacy two-request first-owner enrollment; the atomic RPC and signup trigger continue. No rollback may restore arbitrary self-insert or empty-org-only ownership. Do not drop creator metadata or restore a production backup over newer writes without an approved reconciliation plan.

## Preserved assets
No MBA files, client releases, Android/Telegram/browser integrations, domains, deployment aliases, existing data, analytics or unrelated product code were removed or rewritten. This PR changes one additive migration, synthetic tests, an isolated test runner, CI and this review note only.
