import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { normalizeTemplateBody } from "@/lib/services/template";
import { safeRoute } from "@/lib/api-helpers";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(60).optional(),
  body: z.unknown().optional(),
  is_public: z.boolean().optional()
});

export const GET = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: data });
});

export const PATCH = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const patch: Record<string, unknown> = { ...parsed.data };
  if (patch.body !== undefined) patch.body = normalizeTemplateBody(patch.body);
  const { data, error } = await supabase
    .from("templates")
    .update(patch)
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
});

export const DELETE = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id)
    .eq("org_id", auth.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
