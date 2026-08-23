import { NextResponse } from "next/server";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export interface AuthContext {
  userId: string;
  orgId: string;
}

export async function requireUserOrg(orgIdHeader: string | null): Promise<AuthContext | NextResponse> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let orgId = orgIdHeader;
  if (!orgId) {
    const { data: u } = await supabase.from("users").select("default_org_id").eq("id", user.id).maybeSingle();
    orgId = u?.default_org_id ?? null;
  }
  if (!orgId) {
    return NextResponse.json({ error: "no_org" }, { status: 400 });
  }

  // confirm membership
  const { data: m } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!m) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { userId: user.id, orgId };
}

/** Authenticate the browser extension via API key. */
export async function requireApiKey(authHeader: string | null): Promise<AuthContext | NextResponse> {
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }
  const key = authHeader.slice("Bearer ".length).trim();

  // Dev mode shortcut
  if (env.extensionApiKey && key === env.extensionApiKey) {
    return { userId: "extension", orgId: "extension" };
  }

  const svc = getServiceSupabase();
  const keyHash = await sha256(key);
  const { data, error } = await svc
    .from("api_keys")
    .select("user_id, org_id")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }
  await svc.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", keyHash);
  return { userId: data.user_id, orgId: data.org_id };
}

export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
