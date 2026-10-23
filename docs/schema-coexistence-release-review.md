# Shared profile and deadline schema repair

## What was broken

The full migration chain, unlike the focused tenant test, could not create deadlines: stored generated columns cannot use `now()`. The older `public.users` table also lacked the Tweenz profile columns; `CREATE TABLE IF NOT EXISTS` does not add them. Adding only `role` would expose self-escalation and recursive RLS. `admin_settings` had policies but RLS was never enabled. Finally, the learning signup trigger replaced the older personal-workspace creation instead of preserving it.

## Repair contract

- Correct fresh-install migration 0003 to extend the shared profile explicitly and omit stored risk. This is an exceptional correction of a migration that cannot complete unmodified, not permission to rewrite a production migration ledger.
- Add `20261023165800_tweenz_schema_coexistence.sql` for reviewed databases which already have a manually reconciled Tweenz schema. Preserve existing profile fields, memberships, presentation tables and any legacy risk column/data.
- Ordinary authenticated/anonymous SQL clients cannot insert or update a privileged platform role, even with upserts. Role assignment remains trusted database/service provisioning; this PR does not grant any user admin. Profile preferences remain editable.
- Admin lookup is a qualified, fixed-search-path definer predicate bound only to the authenticated ID. Enable RLS on admin settings. Platform administrators retain their intended read access, without recursive users policies.
- Subscription entitlements, usage limits and Stripe customer linkage are read-only to normal clients. Trusted service webhook writes remain supported; no existing plan or billing identifier is rewritten and no Stripe call is performed.
- New signup atomically creates a personal organization/owner membership and a learning trial. User metadata cannot assign a platform role. Existing users are not automatically backfilled or moved between organizations.
- Profile API preserves the full_name client contract by mapping to display_name. Onboarding uses a caller-bound invoker RPC to atomically update the profile and existing academic fields; a GPA-scale column retains the existing form preference. Failures are explicit and do not redirect as successful saves.
- Deadline risk is derived from due_date on each API response, prompt or export, using a captured current time. Strict original thresholds remain: before now overdue, before 3 days at risk, before 7 days due soon, otherwise safe. Client-supplied risk is never persisted or authoritative.

## Compatibility notes

The current timeline calls completion `is_completed`; the API maps it to the actual `is_done` column and returns the compatible alias. Conflicting aliases are rejected. The existing optional weight input never had a backing deadline column: blank/null remains accepted, but a supplied weight now produces a visible validation error rather than false persistence. No existing weight records are deleted.

Demo profile/onboarding writes explicitly report non-persistence and do not call the database. Authenticated hosted onboarding still requires the acceptance checks below; mocked routes and isolated SQL are complementary evidence, not a live sign-in test.

## Validation

Run `python3 scripts/test-tenant-rls.py --pg-bin /path/to/postgresql/bin --full-chain` against a disposable PostgreSQL installation with pgcrypto and vector. The complete chain plus non-superuser/non-BYPASSRLS profile/admin/deadline assertions must pass, as must the existing six-table tenant regression. `--concurrent` adds the existing creator-bootstrap concurrency test on a permitted disposable local server; it is not a hosted-authentication test.

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` on the exact proposed commit. No production URL or provider key is required. New tests mock external clients; no payments, model calls or emails are made.

## Before production: explicit approval required

1. Refresh branch and deployed SHA and inspect the actual schema/migration ledger read-only. Determine whether 0003 failed transactionally, partially ran manually, or was independently repaired. Never mark it complete blindly, rerun the whole historical migration over a live schema, or infer that local success proves hosted readiness.
2. Review provenance of existing privileged role assignments and subscription/provider customer bindings: historical permissive policies may have allowed tampering. Preserve and reconcile values, never auto-reset or assume legitimacy. Take and verify a full backup and isolated restore. Record current profile columns, roles, policies, triggers, any legacy risk column and presentation/learning record counts.
3. If the actual schema differs from the tested complete chain, prepare a specific reviewed reconciliation migration. The additive migration assumes the learning tables already exist; it intentionally does not silently create missing product tables over unknown state.
4. Coordinate the new API with the schema correction. Old deployed clients selecting risk as a physical column need updating on a fresh schema. Existing legacy risk data is preserved but the repaired API ignores it. Verify saved decks/PPTX and learning sign-in/profile/deadline/edit/export with isolated accounts, tenant boundaries and authenticated PostgREST before exposure.
5. Existing users lacking workspaces or trials need an owner-reviewed backfill inventory. No bulk enrollment, billing/subscription entitlement change or user migration is included here.

## Rollback

Keep the role guard, nonrecursive policies, subscription write restriction and admin-settings RLS enabled. Do not roll back by restoring the invalid generated expression, recursive policy or unrestricted role writes. Pause new affected writes if needed; restore the approved backup only under a reviewed recovery plan. A previous app build is not compatible with a new fresh schema if it still selects the removed risk column. Prefer a forward compatibility hotfix and retain all original data. No production merge, deployment, migration or rollback has been executed by this repair.
