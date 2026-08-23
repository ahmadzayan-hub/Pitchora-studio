# Pitchora — Deployment Playbook

This file exists so any operator (you, on-call, or a future teammate)
can bring Pitchora up on a clean, single, non-duplicated
GitHub + Vercel setup in under 15 minutes.

The current state of the connected Vercel team includes several
projects that all deploy this repository (leftovers from earlier
prototypes). The steps below are the one-time cleanup to reduce that
to a single production project, plus the standing config the branch
`pitchora` needs to keep working forever.

---

## Naming

- **Product name:** Pitchora (Pitch + Aurora)
- **Repo:** `github.com/ahmadzayan-hub/Pitchora-studio-Private`
- **Canonical branch:** `pitchora`
- **Vercel project name:** `pitchora`
- **Production domain:** `www.pitchora.ai` (add via Vercel → Domains)

If you rename the product later, change the eight strings in this
file and grep the codebase for `pitchora` + `Pitchora` + `بِتشورا`.

---

## 1. GitHub — one repo, one canonical branch

1. Keep the existing repo `ahmadzayan-hub/desktop-tutorial` as the
   home of the code. There is no need to fork or rename it.
2. Merge or archive every non-`main` branch that once shipped a
   different product on top of this repo (`claude/*` prototypes,
   `vertex-*` experiments, `tramiq-*` experiments). Leaving them
   around is not a security risk on its own, but each stale branch
   is one more thing a Vercel project can accidentally deploy.
3. The branch **`pitchora`** is the canonical branch. Every Pitchora
   commit ships from here. Protect it in
   Settings → Branches → Add branch protection rule with:
     - Require pull request before merging
     - Require status checks: `typecheck`, `tests`, `build`
     - Require conversation resolution before merging
     - Include administrators

---

## 2. Vercel — collapse duplicates, keep one project

Prior sessions discovered six projects on the team all wired to the
same repo (`desktop-tutorial`, `desktop-tutorial-fz1m`,
`desktop-tutorial-58zf`, `project-sa1ea`, `vercel`, `1`). Every push
was triggering six builds and burning six build-minute counters.

### 2.1 Delete the duplicates

For every project **except** the one you keep:

  Vercel Dashboard → project → Settings → Advanced → Delete Project.

You cannot recover a deleted project's deployments; move any custom
domain to the survivor first (Section 2.4).

### 2.2 Configure the survivor

Rename the survivor to **`pitchora`**:

  Settings → General → Project Name → `pitchora` → Save.

Set the Git integration:

  Settings → Git →
    Repository: `ahmadzayan-hub/Pitchora-studio-Private`
    Production Branch: `pitchora`
    Ignored Build Step: leave blank (the branch-name filter below is
                        enough)

Under Settings → Git → Deploy Hooks:

  Add a deploy hook for the `pitchora` branch only. Delete every
  hook that points at other branches.

Under Settings → Git → Preview Branches:

  Only preview branches that start with `pitchora/` (feature
  branches like `pitchora/nav-fix`). Every other branch should be
  ignored. This is where cross-branch deploy noise dies for good.

### 2.3 Environment variables

Set once, in the survivor's Settings → Environment Variables:

| Var | Scope | Value |
|-----|-------|-------|
| `NEXT_PUBLIC_APP_URL` | Production, Preview | `https://www.pitchora.ai` |
| `NEXT_PUBLIC_SUPABASE_URL` | All | (from Supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | (from Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | (from Supabase — server-only) |
| `STRIPE_SECRET_KEY` | Production, Preview | `sk_live_...` (server-only) |
| `STRIPE_WEBHOOK_SECRET` | Production, Preview | `whsec_...` |
| `OPENAI_API_KEY` | Production, Preview | server-only |
| `NEXT_PUBLIC_DEMO_MODE` | Preview only | `true` (never set in Production) |

**Never** put a key with `_SECRET` / `_KEY` / `_PRIVATE` behind a
`NEXT_PUBLIC_` prefix. Next.js inlines those into the client bundle.
Only `SUPABASE_ANON_KEY` and `APP_URL` are safe to expose.

### 2.4 Domains

Settings → Domains:

  - Primary: `www.pitchora.ai` (Production only)
  - Redirect: `pitchora.ai` → `www.pitchora.ai`
  - Wildcard: `*.pitchora.ai` (once Vercel/Cloudflare are joined)
  - Remove every legacy `desktop-tutorial-*.vercel.app` and
    `project-sa1ea-*.vercel.app` alias — those cannot be indexed by
    Google as the canonical site anyway.

### 2.5 Deployment Protection

Settings → Deployment Protection:

  - Production: **Off** (the marketing site is public).
  - Preview: **Vercel Authentication** (only signed-in team members
    can view previews). This stops accidental indexing of pre-release
    copy and blocks scrapers.

---

## 3. First deploy from a clean state

Once the survivor project is renamed to `pitchora`:

```bash
# From your dev machine, on the canonical branch:
git checkout pitchora
git pull --ff-only origin pitchora

# Vercel picks up the push automatically. If you want to force a
# fresh production deploy without a code change:
git commit --allow-empty -m "chore: force pitchora production deploy"
git push origin pitchora
```

The first build should show four green rows in Vercel:
- `npm ci`
- `npm run typecheck`
- `npm run build`
- Deployment

If any row fails, check that the env vars in Section 2.3 are all
set for Production.

---

## 4. Health checks after a deploy

Open these in a fresh incognito window (no cookies):

- `https://www.pitchora.ai/presentiq` should return 200
- `https://www.pitchora.ai/presentiq/pricing` should return 200
- `https://www.pitchora.ai/robots.txt` should mention `pitchora.ai`
- `https://www.pitchora.ai/sitemap.xml` should list only marketing pages
- `https://www.pitchora.ai/llms.txt` should exist and reference Pitchora
- `https://www.pitchora.ai/manifest.webmanifest` should return
  `application/manifest+json` and name = `Pitchora`

Then the security headers, via
`curl -sI https://www.pitchora.ai/presentiq`:

- `Content-Security-Policy` should be present
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

If any header is missing, the `next.config.mjs` headers rewrite
never ran. Roll back and file an incident.

---

## 5. Ongoing rules

- **One branch, one project.** If a new product needs a different
  Vercel project, create a separate branch **and** a separate repo.
  Do not chain multiple products onto the same repo again.
- **PR previews are private** (Section 2.5). Do not turn them off
  even for demo videos; use the standalone preview URL with a magic
  link cookie instead.
- **Env drift kills stealth.** Whenever you rotate a Stripe key, a
  Supabase service role, or an LLM provider key, update it in both
  Production and Preview scopes at the same time. Never leave one
  side stale.
- **Threat model owns the security surface.** See `THREAT_MODEL.md`
  and `SECURITY.md`. Any change to headers, cookies, auth, or the
  Stripe webhook route must update those docs in the same PR.

---

## 6. If you have to nuke everything and start over

```bash
# 1. Delete every Vercel project tied to this repo.
# 2. Re-import the repo:
#    New Project → Import Git Repository → select desktop-tutorial
#    → Project Name: pitchora
#    → Framework: Next.js
#    → Root Directory: /
# 3. Add the env vars in Section 2.3.
# 4. Set Production Branch: pitchora (Settings → Git).
# 5. First deploy fires automatically.
```

Total wall time to rebuild from scratch: 10 minutes.
