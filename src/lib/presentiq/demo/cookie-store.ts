/**
 * Cookie-backed persistence layer for the demo store.
 *
 * Vercel deploys each route as its own serverless function, so the
 * module-level Map in `store.ts` is not shared across the wizard's
 * sequence of calls (POST /projects → POST /blueprint → POST /slides
 * → POST /export-pptx). To keep the demo flow stateful without a
 * database we round-trip the brief via an HTTP cookie.
 *
 * Only the BRIEF (project metadata, audience, etc.) is persisted in
 * the cookie. Blueprint and slides are deterministic functions of the
 * brief and are regenerated on demand each request, which keeps the
 * cookie comfortably under the ~4KB per-cookie browser limit.
 */

import { cookies, headers } from "next/headers";
import type { DemoBrandKit, DemoProject } from "./store";

const COOKIE_PROJECTS = "pq_demo_state";
const COOKIE_KITS     = "pq_demo_kits";
// Browser cookie cap is ~4096 bytes for the full Set-Cookie line. Leave
// headroom for name + attributes (~300 bytes) and stay under the cap.
const MAX_PROJECTS    = 3;
const MAX_KITS        = 3;
const MAX_BYTES       = 3700;

type SlimProject = Omit<DemoProject, "blueprint" | "slides">;

function slimProject(p: DemoProject): SlimProject {
  const { blueprint, slides, ...rest } = p;
  return rest;
}

// Encode JSON as URL-safe base64. More compact than encodeURIComponent
// (~33% overhead vs ~50–200% for non-ASCII), and produces a value that's
// always safe to put in a Set-Cookie header (no `;`, `,`, `=`, spaces).
function encode(value: unknown): string {
  const json = JSON.stringify(value);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function decode<T = unknown>(raw: string): T | null {
  try {
    // First try base64 (current encoding).
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    // Backward compat — old cookies stored URI-encoded JSON.
    try { return JSON.parse(decodeURIComponent(raw)) as T; }
    catch { return null; }
  }
}

async function readCookie<T = any>(name: string): Promise<Record<string, T>> {
  try {
    const raw = (await cookies()).get(name)?.value;
    if (!raw) return {};
    const parsed = decode<Record<string, T>>(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCookie(name: string, value: Record<string, unknown>) {
  try {
    (await cookies()).set(name, encode(value), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });
  } catch {
    /* called outside a route-handler / server-action context — ignore */
  }
}

// Header fallback — the wizard injects the current project as a base64
// header on every wizard step so we can reconstruct it even if the cookie
// got dropped (size cap, third-party-cookie blocked browser, etc.).
const HEADER_PROJECT = "x-pq-demo-project";

async function readHeaderProject(): Promise<SlimProject | null> {
  try {
    const raw = (await headers()).get(HEADER_PROJECT);
    if (!raw) return null;
    return decode<SlimProject>(raw);
  } catch {
    return null;
  }
}

// ─── Projects ─────────────────────────────────────────────────────────

export async function readCookieProjects(): Promise<Record<string, SlimProject>> {
  return await readCookie<SlimProject>(COOKIE_PROJECTS);
}

export async function writeCookieProjects(projects: Record<string, DemoProject | SlimProject>) {
  const ids = Object.keys(projects).sort((a, b) =>
    String(projects[b]?.updated_at ?? "").localeCompare(String(projects[a]?.updated_at ?? ""))
  );
  let kept: Record<string, SlimProject> = {};
  for (const id of ids.slice(0, MAX_PROJECTS)) {
    kept[id] = slimProject(projects[id] as DemoProject);
  }
  let json = JSON.stringify(kept);
  while (json.length > MAX_BYTES && Object.keys(kept).length > 1) {
    const oldest = Object.keys(kept).pop()!;
    delete kept[oldest];
    json = JSON.stringify(kept);
  }
  await writeCookie(COOKIE_PROJECTS, kept);
}

export async function upsertCookieProject(p: DemoProject) {
  const all = await readCookieProjects();
  all[p.id] = slimProject(p);
  await writeCookieProjects(all);
}

export async function getCookieProject(id: string): Promise<SlimProject | null> {
  const all = await readCookieProjects();
  if (all[id]) return all[id];
  // Header fallback — wizard pins its project on every request.
  const header = await readHeaderProject();
  if (header && header.id === id) return header;
  return null;
}

export async function deleteCookieProject(id: string) {
  const all = await readCookieProjects();
  if (!(id in all)) return false;
  delete all[id];
  await writeCookieProjects(all);
  return true;
}

// ─── Brand kits ───────────────────────────────────────────────────────

export async function readCookieBrandKits(): Promise<Record<string, DemoBrandKit>> {
  return await readCookie<DemoBrandKit>(COOKIE_KITS);
}

export async function writeCookieBrandKits(kits: Record<string, DemoBrandKit>) {
  const ids = Object.keys(kits).sort((a, b) =>
    String(kits[b]?.created_at ?? "").localeCompare(String(kits[a]?.created_at ?? ""))
  );
  let kept: Record<string, DemoBrandKit> = {};
  for (const id of ids.slice(0, MAX_KITS)) {
    kept[id] = kits[id];
  }
  let json = JSON.stringify(kept);
  while (json.length > MAX_BYTES && Object.keys(kept).length > 1) {
    const oldest = Object.keys(kept).pop()!;
    delete kept[oldest];
    json = JSON.stringify(kept);
  }
  await writeCookie(COOKIE_KITS, kept);
}

export async function upsertCookieBrandKit(k: DemoBrandKit) {
  const all = await readCookieBrandKits();
  all[k.id] = k;
  await writeCookieBrandKits(all);
}

export async function getCookieBrandKit(id: string): Promise<DemoBrandKit | null> {
  const all = await readCookieBrandKits();
  return all[id] ?? null;
}
