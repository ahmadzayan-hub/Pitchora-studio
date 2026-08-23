import { getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";

const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const form = await req.formData().catch(() => null);
  if (!form) return fail("invalid_form", "expected multipart form", 400);
  const file = form.get("file");
  const locale = (form.get("locale") as string | null) ?? "en";
  if (!(file instanceof File)) return fail("missing_file", "file is required", 400);
  if (!ALLOWED.includes(file.type)) return fail("unsupported_type", `unsupported: ${file.type}`, 415);
  if (file.size > 5 * 1024 * 1024) return fail("file_too_large", "max 5 MB", 413);

  const supabase = await getSupabase();
  const { data: kit } = await supabase
    .from("pq_brand_kits")
    .select("id, logos")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!kit) return notFound("brand_kit");

  const path = `org/${ctx.orgId}/brand-kits/${params.id}/logos/${Date.now()}-${sanitiseFilename(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("pq-uploads").upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return fail("upload_failed", upErr.message, 500);

  const { data: signed } = await supabase.storage.from("pq-uploads").createSignedUrl(path, 3600 * 24 * 7);
  const newLogo = { url: signed?.signedUrl, path, locale, contentType: file.type };
  const next = Array.isArray(kit.logos) ? [...kit.logos, newLogo] : [newLogo];

  await supabase.from("pq_brand_kits").update({ logos: next }).eq("id", params.id);

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.upload_logo",
    object_type: "brand_kit", object_id: params.id, metadata: { locale, size: file.size },
  });

  return json({ logo: newLogo });
}

function sanitiseFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}
