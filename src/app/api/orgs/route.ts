import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeRoute } from "@/lib/api-helpers";

const Body = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/)
});

export const GET = safeRoute(async () => {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("memberships")
    .select("role, org:org_id(id, name, slug, plan, created_at)")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data });
});

export const POST = safeRoute(async (req: NextRequest) => {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  // One security-definer call creates the organization and its owner membership together
  // (migration 0011). Inserting the row directly is refused by RLS on RETURNING, because the
  // creator is not a member until the membership exists.
  const { data: org, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug
  });
  if (error || !org) {
    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "slug_taken" : error?.message ?? "create_failed" }, { status });
  }

  return NextResponse.json({ org });
});
