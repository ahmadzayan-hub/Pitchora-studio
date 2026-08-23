import { extractTemplate, getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";

/**
 * Runs Template Intelligence on the brand kit's uploaded template (.pptx)
 * and writes design_tokens + layout_library back to the row.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const supabase = await getSupabase();

  const { data: kit } = await supabase
    .from("pq_brand_kits")
    .select("id, organization_id, template_path")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!kit) return notFound("brand_kit");
  if (!kit.template_path) return fail("no_template", "Upload a .pptx template first", 400);

  const { data: file, error: dlErr } = await supabase.storage
    .from("pq-uploads")
    .download(kit.template_path);
  if (dlErr || !file) return fail("download_failed", dlErr?.message ?? "missing", 500);

  const buf = Buffer.from(await file.arrayBuffer());
  const tokens = await extractTemplate(buf);

  const { data: updated, error } = await supabase
    .from("pq_brand_kits")
    .update({
      design_tokens: tokens,
      layout_library: tokens.layouts ?? [],
      colors: {
        primary: tokens.palette.primary,
        secondary: tokens.palette.secondary,
        accent: tokens.palette.accent,
        background: tokens.palette.background,
      },
      fonts: tokens.fonts,
    })
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .select()
    .single();
  if (error) return fail("update_failed", error.message, 500);

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.extract_tokens",
    object_type: "brand_kit", object_id: params.id,
  });

  return json({ brand_kit: updated, tokens });
}
