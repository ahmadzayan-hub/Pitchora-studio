<img src="src/app/presentiq/icon.svg" alt="Existing Pitchora presentation mark" width="76" height="76">

# Pitchora

**Turn source material into a presentation you can explain, edit and review.**

Pitchora brings storyboarding, brand kits, bilingual slide composition and
editable PowerPoint export into one workspace. It is for people preparing a
board, committee or client presentation who need to inspect what supports the
story, not just produce attractive slides.

Next.js 15 · React 18 · TypeScript · Supabase · PPTX · English / العربية

[Capabilities](#what-it-helps-you-do) · [Setup](#local-setup) ·
[Verification](#verify-changes) · [Release guide](docs/REPOSITORY_GUIDE.md) ·
[العربية](#بالعربية)

## Source Studio: local authoring without a model API

![Decorative 3D slide-stack concept, not a product screenshot](public/pitchora/brand-3d.webp)

Open `/presentiq/source-studio`: import a text PDF, TXT, Markdown or CSV; inspect
page-linked excerpts; edit the storyboard; explicitly review each scene; export
editable PPTX, standalone HTML/print-to-PDF, JSON backup and a local video render
package. Sources are processed in the browser, not uploaded by this workflow.
The package can render real MP4 with installed free desktop tools; the ZIP itself
is not a video. [Capabilities, limits, licenses and acceptance](docs/SOURCE_STUDIO.md).

This is a functional **local single-user** workflow, not hosted team persistence
and not automatic LLM reasoning, translation or animated video generation.

## What it helps you do

| Your task | Repository capability | Important boundary |
| --- | --- | --- |
| Shape a presentation | Project wizard, narrative blueprint and slide editor | Generated content still needs a presenter’s review |
| Keep a consistent identity | Brand kits, theme tokens and template tooling | Brand checks are not organizational approval |
| Inspect support for a claim | Evidence references, quality checks and review surfaces | A citation does not establish that a claim is true |
| Work in two languages | English/Arabic composition and RTL handling | Review wording and exported layout in both languages |
| Hand off an editable deck | PPTX rendering and export routes | An exported file is not an accepted deliverable until checked |

**Source material → Storyboard → Slides → Brand and evidence review → Editable export**

## Current status

This is the `Pitchora-studio` repository on `main`. The presentation application lives
at `/presentiq`. Its source also retains inherited learning routes and client
packages; they are preserved, not reclassified as verified Pitchora features.
See [product boundaries](docs/PRODUCT_AUTHORITY.md).

The 23 October 2026 integration passed **227 tests across 27 suites**, TypeScript,
lint, a production build and isolated PostgreSQL fresh-schema, additive-upgrade
and tenant-concurrency checks on `5cd8dc86334990a13c822adc1c837d8e0f0e925c`.
[Quality result](https://github.com/ahmadzayan-hub/Pitchora-studio/actions/runs/40004690768) · [Database result](https://github.com/ahmadzayan-hub/Pitchora-studio/actions/runs/40004690739)

**Code verification is not a completed hosted release.** Real hosted sign-in,
PostgREST identity enforcement, existing production schema, historical role and
billing-link provenance, backup recovery and end-user acceptance still require
verification. A green CI build, static GitHub Page or preview URL does not
establish those properties.

Sample-data mode and the deterministic mock model exist for development. They
are not the authenticated, durable product and must not be described as such.
This README does not claim a verified production URL or change an existing host.

## Local setup

Quality CI uses Node.js 22 and the committed npm lockfile.

```bash
git clone https://github.com/ahmadzayan-hub/Pitchora-studio.git
cd Pitchora-studio
npm ci
cp .env.example .env.local
```

Before starting an authenticated installation, configure a dedicated development
backend and review the [setup and release guide](docs/REPOSITORY_GUIDE.md).

- Set `NEXT_PUBLIC_DEMO_MODE=false`. The example file defaults to sample data;
  changing this flag alone does not connect a backend.
- Supply the correct Supabase URL and public key. Keep the service-role key on
  the server, never in browser code or a public environment variable.
- Verify the complete schema on an isolated database. Do not run only the
  presentation migration or replay historical migrations over an unknown live
  database. Follow the [schema coexistence review](docs/schema-coexistence-release-review.md)
  and [tenant enrollment review](docs/tenant-enrollment-release-review.md).
- Presentation generation defaults to free deterministic source extraction, even
  when a model key exists. Anthropic is optional only when explicitly selected
  by an approved caller; mock is test-only explicit selection. Provider spend
  and source-sharing approval remain separate.
- Configure storage and any optional billing integration only for the intended
  project. Missing payment configuration is not permission to use live payments
  for a smoke test.

```bash
npm run dev
```

Open **http://localhost:3000/presentiq**. The development server is only the
application process; it does not provision a database, identity provider,
storage, billing or model service.

## Architecture

| Area | Source |
| --- | --- |
| Presentation pages and editor | `src/app/presentiq/` |
| Presentation API | `src/app/api/presentiq/` |
| Story, evidence, brand, model and rendering logic | `src/lib/presentiq/` |
| Presentation components | `src/components/presentiq/` |
| Schema and isolated database regressions | `supabase/`, `scripts/test-tenant-rls.py` |
| Product and design specifications | `docs/presentiq/` |

The shared profile/learning schema is an integration boundary. Recent repairs
preserve existing records, calculate deadline risk at read time, prevent normal
profile writes from assigning privileged roles, and restrict client-side
subscription changes. They do not certify historical data or assign new owners.

## Verify changes

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For database checks, use an isolated PostgreSQL installation with the extensions
specified in the [schema review](docs/schema-coexistence-release-review.md):

```bash
python3 scripts/test-tenant-rls.py --pg-bin /path/to/postgresql/bin --full-chain --concurrent
```

The concurrent check starts a disposable local database and needs permission
to do so. Never point this test at production. Hosted authentication, real
browser flows and recovery exercises remain separate acceptance checks.

## Documentation

- [Product authority](docs/PRODUCT_AUTHORITY.md) and [design-document index](docs/presentiq/README.md)
- [Architecture](docs/presentiq/02-ARCHITECTURE.md), [API](docs/presentiq/05-API.md) and [PPTX rendering](docs/presentiq/10-PPTX-RENDERING.md)
- [Security policy](SECURITY.md) and [threat model](THREAT_MODEL.md)
- [Schema release review](docs/schema-coexistence-release-review.md) and [tenant release review](docs/tenant-enrollment-release-review.md)
- [Repository guide](docs/REPOSITORY_GUIDE.md) for contribution checks, setup caveats and visual provenance
- [Changelog](CHANGELOG.md)

Older deployment notes contain inherited repository, branch and domain
assumptions. Do not use them to delete projects, move domains or skip the
current release reviews.

## بالعربية

**Pitchora** مساحة لإعداد عروض تقديمية قابلة للتحرير والمراجعة، من تنظيم القصة
والمصادر إلى الهوية البصرية وتصدير PowerPoint. تبقى مسؤولية التحقق من الادعاءات
واعتماد العرض لدى المستخدم.

نجاح الاختبارات لا يعني أن النسخة التشغيلية الكاملة أصبحت متاحة. التشغيل الفعلي
يحتاج هوية حقيقية وقاعدة بيانات وتخزينًا وخدمة توليد مُهيأة ومختبرة. البيانات
التجريبية والمولد الوهمي ليسا بديلًا عن ذلك، ولا يُقدمان على أنهما تشغيل كامل.

## License and contributions

Proprietary. All rights reserved. This preserves the existing README notice;
it does not introduce a new license. Preserve existing assets and notices,
keep changes reviewable, and do not commit secrets or customer documents.
