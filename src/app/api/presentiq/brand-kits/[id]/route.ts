import { getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("pq_brand_kits")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!data) return notFound("brand_kit");
  return json({ brand_kit: data });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  if (!["owner", "admin", "editor"].includes(ctx.role)) return fail("forbidden", "insufficient role", 403);
  const supabase = await getSupabase();
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = [
    "name", "is_default", "logos", "colors", "fonts", "typography_rules",
    "layout_rules", "chart_rules", "terminology", "forbidden_patterns",
    "compliance_rules", "design_tokens", "layout_library",
  ];
  const filtered: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) filtered[k] = patch[k];
  if (filtered.is_default === true) {
    await supabase.from("pq_brand_kits").update({ is_default: false }).eq("organization_id", ctx.orgId);
  }
  const { data, error } = await supabase
    .from("pq_brand_kits")
    .update(filtered)
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .select()
    .single();
  if (error) return fail("update_failed", error.message, 500);
  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.update",
    object_type: "brand_kit", object_id: params.id, metadata: { fields: Object.keys(filtered) },
  });
  return json({ brand_kit: data });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  if (!["owner", "admin"].includes(ctx.role)) return fail("forbidden", "owner/admin only", 403);
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("pq_brand_kits")
    .delete()
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId);
  if (error) return fail("delete_failed", error.message, 500);
  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.delete",
    object_type: "brand_kit", object_id: params.id,
  });
  return json({ ok: true });
}
