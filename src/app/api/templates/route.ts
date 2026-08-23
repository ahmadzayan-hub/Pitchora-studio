import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { normalizeTemplateBody } from "@/lib/services/template";
import { safeRoute } from "@/lib/api-helpers";

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().max(60).optional(),
  body: z.unknown(),
  is_public: z.boolean().optional()
});

export const GET = safeRoute(async (req: NextRequest) => {
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .or(`org_id.eq.${auth.orgId},is_public.eq.true`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
});

export const POST = safeRoute(async (req: NextRequest) => {
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      org_id: auth.orgId,
      created_by: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      body: normalizeTemplateBody(parsed.data.body),
      is_public: parsed.data.is_public ?? false
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
});
