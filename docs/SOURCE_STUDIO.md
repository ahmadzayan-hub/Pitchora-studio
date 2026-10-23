# Source Studio delivery and release evidence

## Product decision

The useful no-subscription slice is a real browser-local authoring tool, not another sample deck: source text → attributed excerpts → editable storyboard → explicit author review → editable PPTX / standalone HTML / JSON recovery / local MP4 rendering package. Route: `/presentiq/source-studio`.

Source Studio is separate from the hosted tenant workspace. It never silently uploads source files, calls a paid model, generates invented charts, or publishes a deliverable. Local save is browser-local, not durable cloud storage. Exported JSON and video packages contain source text: share intentionally.

## Inputs, safeguards and limitations

- Text PDF, TXT, Markdown and CSV, up to 10 MB/file, 10 sources, 200,000 combined characters. PDF limit: 200 pages and 30-second extraction deadline. Browser source text limit is 100,000 characters/file.
- PDF citations retain actual page numbers. Spans refer to normalized extracted page text, not original file bytes. Scanned/image-only PDFs fail explicitly; OCR, embedded images and table structure are not extracted. Reading order, especially multi-column Arabic, requires human checking.
- CSV is source text, not automatically interpreted statistics. Numbers are checked against the selected passage, but units, meaning, truth and numerical equivalence still need the author's review. The software is not a fact checker.
- First 12 passages seed the storyboard. The deterministic composer copies text rather than claiming LLM understanding or translation. Other passages remain in the source ledger but are not automatically included.
- Edits reset review. Unknown citations, unsupported numeric strings and invalid structures prevent export. A checkbox records the author's review, not independent verification or organizational approval.
- Browser storage can be erased; download JSON backups. JSON restore is validated and preserves current work on invalid input.

## Outputs

| Output | Real behavior | Boundary |
|---|---|---|
| PPTX | Editable text, full reviewed scene text, visible short citations and detailed source notes | Inspect line fitting and fonts in the target PowerPoint application |
| HTML | Standalone escaped content, source attribution and browser print/PDF | Browser printing is not a server-generated PDF artifact |
| JSON | Editable versioned project with sources, scenes, manual durations and review flags | Not encrypted; not cloud sync |
| Video ZIP | PPTX, timeline, project, Python renderer and instructions | ZIP is not MP4 |
| Local MP4 | LibreOffice → Poppler → FFmpeg, H.264/yuv420p/30fps, optional original narration AAC/48kHz | Held slides, not generated animation; external desktop tools required |

Install tools only from official projects or your OS package manager. Unzip a reviewed package in its own directory and run `python3 render_video.py`. Optional original narration: `python3 render_video.py --audio narration.wav`. Manual cue duration must equal measured narration duration. `--fit-audio` explicitly scales cues proportionally, not word-level alignment. Narration is not time-stretched or invented. No music is added. Existing output.mp4 is not overwritten.

Renderer uses argument arrays, bounded input sizes and timeouts. The technical report checks codecs, frame rate, dimensions and duration. Watch the entire output with sound, including the ending, Arabic shaping, citations and mobile readability. Synthetic tone tests prove duration/codec handling, not speech synchronization or voice quality. Only render packages you created/reviewed, not arbitrary third-party executable scripts.

## Optional agent path

Hosted orchestration now receives actual evidence content and exact IDs. Explicitly approved model selection supports one bounded grounding repair, then visible failure. Invalid/empty model output, provider failure and cancellation cannot become successful fallback content. The default is extractive even when an Anthropic key exists. Mock selection is test-only. No new inference provider, credential or paid call is installed/enabled by this change.

Existing sample-data routes remain labeled legacy demo infrastructure. Hosted regeneration now refuses replacement when slides already exist: the current unique `(project_id, slide_number)` constraint cannot safely store parallel versions. Old slides are preserved, not deleted before insertion. First-generation writes are checked. A reviewed atomic replacement migration/RPC and recovery test are required before hosted regeneration is enabled; this release applies no database migrations.

## Free/open-source choices checked against official sources

- [PptxGenJS](https://github.com/gitbrent/PptxGenJS): existing MIT dependency, editable PowerPoint. Reused rather than replacing the stack.
- [Mozilla PDF.js](https://github.com/mozilla/pdf.js): Apache-2.0, replaced obsolete pdf-parse PDF.js with pinned pdfjs-dist 6.4.299 and true per-page extraction.
- [Marp CLI](https://github.com/marp-team/marp-cli): MIT, useful Markdown/HTML/PDF/PPTX alternative; normal PPTX is slide images and editable mode is experimental. Not installed because editable PptxGenJS already exists.
- [Slidev](https://github.com/slidevjs/slidev) and [reveal.js](https://github.com/hakimel/reveal.js): MIT alternatives for web presentations. No competing framework installed.
- [Motion Canvas](https://github.com/motion-canvas/motion-canvas): MIT candidate for a later bounded animation composition stage, not implemented here.
- [FFmpeg licensing](https://www.ffmpeg.org/legal.html): LGPL/GPL depends on build options; this project invokes an installed binary, does not redistribute one or promise patent clearance.
- [Remotion license](https://www.remotion.dev/docs/license): not universally free for all company sizes/use cases. Not installed or represented as an unrestricted free dependency.

## Acceptance and release gates

Tests cover real two-page PDF attribution, Arabic/English sources, decimal/CSV preservation, malformed/unsupported input, source/number checks, model repair bounds, canceled/failed generation, editable PPTX XML/notes, full multiline preservation, unsafe control characters, escaped HTML and project recovery. Browser CI covers desktop/mobile authoring and downloads. Media CI renders actual synthetic Arabic slides with a four-second tone and probes the MP4. No real customer files or private PDF attachment are in fixtures.

Before production: require green checks on the changed SHA, review browser screenshots and media artifacts, verify the selected Vercel project/source/root and hosting quota. Source Studio requires no migration or secret. Rollback is a normal revert/redeploy of this code, preserving downloaded JSON and existing database data.

Still unverified/not implemented: hosted sign-in and tenant lifecycle acceptance, private cloud upload/recovery, atomic slide replacement, durable background workers, real-device PowerPoint/video inspection, OCR, automatic chart interpretation, local model deployment, automatic speech alignment, advanced motion, video upload/export on Vercel, and all-format presentation conversion. No claim of complete production acceptance is made.

The decorative generated slide-stack image preserves the existing canonical icon and palette. It is a brand concept, not a screenshot, source evidence or a promise of generated results.

### Security release gate

An npm production audit on the starting dependency tree reported 17 findings (1 critical, 15 high, 1 moderate). Next.js advisory [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) lists the 15.x patch at 15.5.28, with Sharp 0.35.5. Dependency patches must pass fresh CI and the final lockfile audit before deployment. Do not interpret `fixAvailable: false` as proof no vendor patch exists, or use forced major upgrades without compatibility review. Existing ExcelJS/PptxGenJS transitive advisories remain a separate triage gate; local text-only exports do not establish that all legacy server file parsers are safe.

### Refreshed deployment map (23 October 2026, 20:03 UTC)

Canonical `ahmadzayan-hub/Pitchora-studio` main baseline: `456a5fb628a33a67bd3c15bca970b5fb6c7a6c25`. Vercel's repository URL filter returned no linked project for this canonical repository. Do not treat the sibling's public alias as the current code.

Existing `pitchorastudio.vercel.app` points to sibling repository `pitchorastudio`, production deployment `dpl_CrEiS55DAzyWXMuXBN7GASUM8CRK`, main SHA `339c2cc9f98fd9aa7a6fc55e4287acb445fc1b21`. Latest READY preview `dpl_8qiGHGErKjb5YPrPARehJ14k56vK` uses sibling branch `codex/schema-runtime-coexistence-20261023`, SHA `750529faef643ba9b0acc420d035e206755e0ea6`. Configured production branch/root were not returned and remain unverified. Other projects named pitchora, pitchora2 and pitchora-u3c2 returned no domains/latest deployment. No source links, domains or projects were changed. Canonical deployment requires a specific approved source-link decision and refreshed root/runtime settings.

### Targeted dependency remediation

Verified registry versions/integrities and a fresh `npm ci` confirm Next15.5.28 and resolved Sharp0.35.5. Targeted overrides select Next's nested PostCSS8.5.26, PptxGenJS's image-size2.0.4, brace-expansion1.1.21/2.1.7 and source-map-js1.2.2. No forced framework major update or ExcelJS downgrade.

[image-size ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) list2.0.3 as patched. PptxGenJS3.12's shipped CJS/ES/browser bundles do not import image-size (its manifest retains the dependency). The current official PptxGenJS4.0.1 also retains1.x, so upgrading that framework would not alone fix the dependency. The scoped override is covered by actual legacy-layout PNG embedding and editable SourceStudio PPTX regression exports, not by assuming a v1/v2 API match for unknown callers.

Final production lockfile audit after these patches: **0 critical, 0 high, 2 moderate**. The two entries are ExcelJS and its uuid8.3.2 dependency, arising from UUID buffer-bounds behavior. No downgrade, forced major UUID override or suppression is applied. Existing spreadsheet loading must still be reviewed for untrusted input resource limits; zero high findings is not a general security certification. Full development-dependency audit is a separate check.

### Model lifecycle and failure handling

As checked23October2026 against [official lifecycle documentation](https://platform.claude.com/docs/en/about-claude/model-deprecations), the existing optional `claude-sonnet-4-6` API model remains active. This is not a claim that an account has quota, permission or paid credit. `ANTHROPIC_MODEL` permits an owner-approved configuration change, but neither setting a key nor model enables inference: default composition remains extractive. No model upgrade, paid request or cross-provider fallback was executed.

[Official error documentation](https://platform.claude.com/docs/en/api/errors) distinguishes rate/spend limits, missing resources, authentication, permission, timeout and overload. The adapter returns safe typed failures for these cases, never raw provider bodies. A404 means unavailable and may reflect an unknown, retired or inaccessible model; it is not definitive proof of retirement. A429 may be rate or quota exhaustion.400 remains an invalid-request/configuration error because it is not always quota-related. No automatic retries, purchases, model switches or fake-success content. Default mock embedding fallback was removed. Removed sampling parameters are omitted rather than sent to future models that reject them.

Local source authoring and existing downloaded exports do not depend on model availability. Open-source/local software has no model-API fee in this mode, but does not promise unlimited free hosting, compute, storage or third-party service quotas. Fixture tests cover provider statuses, invalid/empty output, cancellation and no fallback; no live model call was used for acceptance.
