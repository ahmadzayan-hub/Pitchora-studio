# Repository guide

## Repository identity

The reviewed source is `ahmadzayan-hub/Pitchora-studio`, branch `main`.
The similarly named Pitchora repository is a distinct repository. Do not merge,
archive, rename or reroute either one merely because their names or code overlap.
Presentation links remain under `/presentiq`; inherited learning and client
assets remain in place.

## Authenticated setup, not a sample-data shortcut

1. Install the locked dependencies using Node.js 22 and `npm ci`.
2. Copy `.env.example` to a private `.env.local`; replace placeholders only for
   the backend and services approved for this installation.
3. For a real installation, set `NEXT_PUBLIC_DEMO_MODE=false` and configure
   Supabase Auth, the public URL/key and server-only privileged credentials.
4. Inspect the target schema and migration ledger before selecting a migration
   plan. Fresh installation and an existing-data upgrade are different paths.
5. Configure the storage policies and generation provider used by the actual
   presentation routes. `src/lib/presentiq/ai/provider.ts` implements Anthropic
   and deterministic mock resolution; additional provider names in an example
   file do not prove adapters are wired into this workflow. Its default
   embedding fallback is also deterministic, not semantic retrieval evidence.
6. Start the application with `npm run dev`; verify identity, tenant isolation,
   project save/reload, generation provenance and editable export with isolated
   acceptance accounts and authorized sample inputs.

Never commit `.env.local`, tokens, provider keys, private documents or backups.
Never treat a sample `EXTENSION_API_KEY` or mock identity as production access.

## Database and release gates

Use [the schema review](schema-coexistence-release-review.md) and
[the tenant review](tenant-enrollment-release-review.md) as the detailed checklists.

- Record the exact source SHA, existing host, backend project and migration ledger.
- Inspect historical privileged roles and subscription/provider customer bindings.
  Preserve values until their provenance has been reconciled; do not guess owners.
- Verify a complete backup by restoring to an isolated database.
- Prove schema compatibility, row preservation and denied cross-tenant access.
- Run authenticated hosted onboarding and repeated/concurrent submissions.
- Check presentation files, saved deck links, profiles and exports after upgrade.
- Approve the specific migration and deployment before changing live state.

The additive schema repair assumes reviewed existing learning tables. It does
not authorize blindly rerunning or marking complete a partially applied legacy
migration. Keep the role and subscription protections in a fail-closed rollback;
do not restore the former permissive policies.

The existing `DEPLOY.md` predates the current verified repository mapping and
contains cleanup and domain instructions. It is historical context, not
permission or a safe current plan to delete projects, branches or aliases.

## Verification and contribution

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` on the exact
source being reviewed. Run the PostgreSQL full-chain/concurrency command from
the README only against its disposable test database. Preserve presentation,
learning, desktop, mobile and extension assets; product-boundary cleanup is a
separate reviewed change, not part of documentation polish.

See [SECURITY.md](../SECURITY.md) before reporting security findings. Do not put
secrets or customer records in a public issue. No response-time commitment or
new security contact is created by this guide.

## Visual assets

The README uses the existing `src/app/presentiq/icon.svg` mark unchanged.
It is a brand asset, not an application screenshot or a readiness certificate.
No new logo, generated product screenshot, endorsement or license is introduced.
All existing images remain in their original paths.
