import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, DEMO_USER } from "@/lib/demo";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";

function isMissingSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes("placeholder") || url === PLACEHOLDER_URL;
}

function makeNullClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
  } as any;
}

export async function createClient() {
  if (isMissingSupabase()) return makeNullClient();
  // Next 15: cookies() is async.
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {}
        },
      },
    }
  );
}

export function createServiceClient() {
  if (isMissingSupabase()) return makeNullClient();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getUser() {
  if (isDemoMode) return DEMO_USER as any;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  if (isDemoMode) {
    return { user: DEMO_USER as any, supabase: makeNullClient(), unauthorized: null };
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { user: null, supabase, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { user, supabase, unauthorized: null };
  } catch {
    const supabase = await createClient();
    return { user: null, supabase, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}
