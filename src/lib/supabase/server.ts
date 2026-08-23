import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, assertSupabaseEnv } from "@/lib/env";

export async function getServerSupabase() {
  assertSupabaseEnv();
  // Next 15: cookies() is async.
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          /* called from a Server Component – safe to ignore */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          /* ignore */
        }
      }
    }
  });
}

import { createClient } from "@supabase/supabase-js";

/** Service-role client for trusted server work (extension API, internal jobs). */
export function getServiceSupabase() {
  if (!env.supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
