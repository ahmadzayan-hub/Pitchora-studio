import {
  buildOrchestrator,
  getRequestContext,
  getSupabase,
  isDemoContext,
  loadBrandContext,
  resolveProvider,
  writeAudit,
} from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";
import { getProject as getDemoProject } from "@/lib/presentiq/demo/store";
import { buildDemoBlueprint, buildDemoSlides } from "@/lib/presentiq/demo/blueprint";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request, props: { params: Promise<{ id: string; slideId: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { instruction?: string };
  const instruction = (body.instruction ?? "regenerate").slice(0, 280);

  // Demo path — apply a deterministic, instruction-aware tweak.
  if (isDemoContext(ctx)) {
    const demo = await getDemoProject(params.id);
    if (!demo) return notFound("project");
    const blueprint = demo.blueprint ?? buildDemoBlueprint(demo);
    const slides = demo.slides && demo.slides.length
      ? demo.slides
      : buildDemoSlides({ title: demo.title, language_mode: demo.language_mode, blueprint });
    const slide = slides.find((s: any) => s.id === params.slideId);
    if (!slide) return notFound("slide");

    const ins = instruction.toLowerCase();
    let next: any = { ...slide };
    if (ins.includes("simplif") || ins.includes("one idea")) {
      const c: any = slide.content_json ?? {};
      if (Array.isArray(c.bullets)) {
        next.content_json = { ...c, bullets: c.bullets.slice(0, 3) };
      }
      next.key_message_en = "One idea, supported by three points.";
      next.key_message_ar = "فكرة واحدة، مدعومة بثلاث نقاط.";
    } else if (ins.includes("executive") || ins.includes("statement")) {
      next.title_en = (slide.title_en ?? "").replace(/[.:]+$/, "") + " — recommended action";
      next.key_message_en = "State the action; everything else is rationale.";
      next.key_message_ar = "اذكر الإجراء؛ ما عداه مبرّرات.";
    } else if (ins.includes("visual") || ins.includes("chart") || ins.includes("diagram")) {
      next.content_json = { kind: "kpi", cards: [
        { label: "On-track",  value: "78%", delta: "+6 pp QoQ" },
        { label: "At-risk",   value: "14%", delta: "-3 pp QoQ" },
        { label: "Off-track", value: "8%",  delta: "-3 pp QoQ" },
        { label: "Capex",     value: "AED 4.8M" },
      ]};
    } else if (ins.includes("arabic") || ins.includes("translate")) {
      // Make sure AR fields are filled in
      next.title_ar = slide.title_ar ?? `العربية: ${slide.title_en ?? ""}`;
      next.key_message_ar = slide.key_message_ar ?? `الرسالة الرئيسية بالعربية لـ${slide.title_en ?? ""}.`;
    } else if (ins.includes("bilingual")) {
      next.title_ar = slide.title_ar ?? `العربية: ${slide.title_en ?? ""}`;
      next.key_message_ar = slide.key_message_ar ?? "النسخة العربية الموازية للرسالة الرئيسية.";
    } else if (ins.includes("speaker") || ins.includes("notes")) {
      next.speaker_notes_en = (slide.speaker_notes_en ?? "") + "\n— Read the headline number, then the delta.";
      next.speaker_notes_ar = (slide.speaker_notes_ar ?? "") + "\n— اقرأ الرقم الرئيسي، ثم التغيّر.";
    } else {
      // Generic regenerate — bump key message and reset status.
      next.key_message_en = (slide.key_message_en ?? "") + " (revised)";
    }
    next.status = "revised";
    return json({ slide: next });
  }

  const supabase = await getSupabase();
  const [{ data: project }, { data: slide }] = await Promise.all([
    supabase.from("pq_presentation_projects").select("*").eq("id", params.id).eq("organization_id", ctx.orgId).maybeSingle(),
    supabase.from("pq_slides").select("*").eq("id", params.slideId).eq("organization_id", ctx.orgId).maybeSingle(),
  ]);
  if (!project || !slide) return notFound("slide");
  if (slide.status === "locked") return fail("locked", "slide is locked", 409);

  const { data: kit } = project.brand_kit_id
    ? await supabase.from("pq_brand_kits").select("*").eq("id", project.brand_kit_id).maybeSingle()
    : { data: null };
  const brandCtx = loadBrandContext(kit, project.presentation_mode, project.language_mode);

  const provider = resolveProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    confidentiality: project.confidentiality_level,
  });
  const orch = buildOrchestrator({ provider, orgId: ctx.orgId });

  let next;
  try {
    next = await orch.regenerateSlide({
      slide: {
        slide_number: slide.slide_number,
        title_en: slide.title_en ?? undefined,
        title_ar: slide.title_ar ?? undefined,
        key_message_en: slide.key_message_en ?? undefined,
        key_message_ar: slide.key_message_ar ?? undefined,
        purpose: slide.purpose ?? undefined,
        content_json: slide.content_json,
        visual_json: slide.visual_json,
        speaker_notes_en: slide.speaker_notes_en ?? undefined,
        speaker_notes_ar: slide.speaker_notes_ar ?? undefined,
      },
      instruction,
      ctx: brandCtx,
    });
  } catch (e) {
    return fail("generation_failed", (e as Error).message, 500);
  }

  const { data, error } = await supabase
    .from("pq_slides")
    .update({
      title_en: next.title_en ?? slide.title_en,
      title_ar: next.title_ar ?? slide.title_ar,
      key_message_en: next.key_message_en ?? slide.key_message_en,
      key_message_ar: next.key_message_ar ?? slide.key_message_ar,
      content_json: next.content_json ?? slide.content_json,
      visual_json: next.visual_json ?? slide.visual_json,
      speaker_notes_en: next.speaker_notes_en ?? slide.speaker_notes_en,
      speaker_notes_ar: next.speaker_notes_ar ?? slide.speaker_notes_ar,
      status: "revised",
    })
    .eq("id", params.slideId)
    .eq("organization_id", ctx.orgId)
    .select()
    .single();
  if (error) return fail("update_failed", error.message, 500);

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "slide.regenerate",
    object_type: "slide", object_id: params.slideId, metadata: { instruction },
  });

  return json({ slide: data });
}
