import {
  buildOrchestrator,
  getRequestContext,
  getSupabase,
  loadBrandContext,
  resolveProvider,
  writeAudit,
} from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";

export const runtime = "nodejs";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { target?: "en" | "ar" };
  const target = body.target === "en" ? "en" : "ar";

  const supabase = await getSupabase();
  const { data: project } = await supabase
    .from("pq_presentation_projects")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!project) return notFound("project");

  const [{ data: kit }, { data: slides }] = await Promise.all([
    project.brand_kit_id
      ? supabase.from("pq_brand_kits").select("*").eq("id", project.brand_kit_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("pq_slides").select("*").eq("project_id", params.id).order("slide_number"),
  ]);
  if (!slides?.length) return fail("no_slides", "Generate slides first", 400);

  const brandCtx = loadBrandContext(kit, project.presentation_mode, project.language_mode);
  const provider = resolveProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    confidentiality: project.confidentiality_level,
  });
  const orch = buildOrchestrator({ provider, orgId: ctx.orgId });

  // Translate slide-by-slide via the revision agent for resilience.
  const translated: any[] = [];
  for (const s of slides) {
    try {
      const result = await orch.regenerateSlide({
        slide: {
          slide_number: s.slide_number,
          title_en: s.title_en,
          title_ar: s.title_ar,
          key_message_en: s.key_message_en,
          key_message_ar: s.key_message_ar,
          content_json: s.content_json,
          visual_json: s.visual_json,
        },
        instruction: target === "ar" ? "Add high-quality formal corporate Arabic for this slide." : "Add an English translation for this slide.",
        ctx: brandCtx,
      });
      translated.push({ id: s.id, ...result });
      await supabase
        .from("pq_slides")
        .update({
          title_en: result.title_en ?? s.title_en,
          title_ar: result.title_ar ?? s.title_ar,
          key_message_en: result.key_message_en ?? s.key_message_en,
          key_message_ar: result.key_message_ar ?? s.key_message_ar,
        })
        .eq("id", s.id);
    } catch (e) {
      translated.push({ id: s.id, error: (e as Error).message });
    }
  }

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "project.translate",
    object_type: "project", object_id: project.id, metadata: { target },
  });

  return json({ slides: translated });
}
