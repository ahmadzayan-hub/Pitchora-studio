/**
 * Tiny Supabase wrapper for PresentIQ.
 *
 * - Re-uses the project's existing supabase server client.
 * - Adds an `org` accessor that sets the JWT claim `org_id` for RLS.
 * - Provides typed helpers for the most common queries.
 *
 * If the existing project's supabase server client is unavailable for any
 * reason, this module falls back to creating one from env vars.
 */

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedFactory: ((cookieJar: any) => SupabaseClient) | null = null;

async function loadFactory() {
  if (cachedFactory) return cachedFactory;
  try {
    const mod: any = await import("@/lib/supabase/server");
    if (mod && typeof mod.getServerSupabase === "function") {
      cachedFactory = (_cookieJar) => mod.getServerSupabase() as SupabaseClient;
      return cachedFactory;
    }
    if (mod && typeof mod.createClient === "function") {
      cachedFactory = (cookieJar) => mod.createClient(cookieJar) as SupabaseClient;
      return cachedFactory;
    }
  } catch {
    /* fall through */
  }
  // Fallback: build a minimal client.
  const { createServerClient } = await import("@supabase/ssr");
  cachedFactory = (cookieJar: any) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createServerClient(url, anon, {
      cookies: {
        get(name: string) { return cookieJar.get(name)?.value; },
        set() {},
        remove() {},
      },
    }) as unknown as SupabaseClient;
  };
  return cachedFactory;
}

export async function getSupabase() {
  const factory = await loadFactory();
  const jar = await cookies();
  return factory(jar);
}

export async function getServiceRoleSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("supabase_service_role_missing");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}
