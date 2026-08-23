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

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug: parsed.data.slug })
    .select("*")
    .single();
  if (error || !org) return NextResponse.json({ error: error?.message }, { status: 500 });

  await supabase.from("memberships").insert({
    user_id: user.id,
    org_id: org.id,
    role: "owner"
  });

  return NextResponse.json({ org });
});
