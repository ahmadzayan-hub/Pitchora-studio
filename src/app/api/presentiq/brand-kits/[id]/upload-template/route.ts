import { getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";

const ALLOWED = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const form = await req.formData().catch(() => null);
  if (!form) return fail("invalid_form", "expected multipart form", 400);
  const file = form.get("file");
  if (!(file instanceof File)) return fail("missing_file", "file is required", 400);
  if (!ALLOWED.includes(file.type) && !file.name.toLowerCase().endsWith(".pptx")) {
    return fail("unsupported_type", "only .pptx is supported", 415);
  }
  if (file.size > 50 * 1024 * 1024) return fail("file_too_large", "max 50 MB", 413);

  const supabase = await getSupabase();
  const { data: kit } = await supabase
    .from("pq_brand_kits")
    .select("id")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!kit) return notFound("brand_kit");

  const path = `org/${ctx.orgId}/brand-kits/${params.id}/template.pptx`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("pq-uploads").upload(path, buf, {
    contentType: ALLOWED[0],
    upsert: true,
  });
  if (upErr) return fail("upload_failed", upErr.message, 500);

  await supabase.from("pq_brand_kits").update({ template_path: path }).eq("id", params.id);

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.upload_template",
    object_type: "brand_kit", object_id: params.id, metadata: { size: file.size },
  });

  return json({ ok: true, template_path: path });
}
