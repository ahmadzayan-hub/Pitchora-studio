import { getRequestContext, getSupabase, isDemoContext, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound } from "@/lib/presentiq/api/response";
import { getProject as getDemoProject, updateProject as updateDemoProject, deleteProject as deleteDemoProject } from "@/lib/presentiq/demo/store";
import { buildDemoBlueprint, buildDemoSlides } from "@/lib/presentiq/demo/blueprint";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (isDemoContext(ctx)) {
    const demo = await getDemoProject(params.id);
    if (!demo) return notFound("project");
    // Slides are deterministic functions of the brief — regenerate on demand
    // when the in-memory cache is empty (different lambda from the one that
    // generated them). The cookie store deliberately drops slides to stay
    // under the ~4 KB browser limit.
    const blueprint = demo.blueprint ?? buildDemoBlueprint(demo);
    const slides =
      demo.slides && demo.slides.length
        ? demo.slides
        : buildDemoSlides({
            title: demo.title,
            language_mode: demo.language_mode,
            blueprint,
          });
    return json({
      project: { ...demo, blueprint },
      files: [],
      slides,
      versions: [{ id: "demo-v1", version_number: 1, readiness_score: 0.84 }],
    });
  }
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("pq_presentation_projects")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!data) return notFound("project");

  const [{ data: files }, { data: slides }, { data: versions }] = await Promise.all([
    supabase.from("pq_source_files").select("id,filename,file_type,size_bytes,ingestion_status,injection_check_status").eq("project_id", params.id),
    supabase.from("pq_slides").select("*").eq("project_id", params.id).order("slide_number"),
    supabase.from("pq_deck_versions").select("*").eq("project_id", params.id).order("version_number", { ascending: false }),
  ]);

  return json({
    project: data,
    files: files ?? [],
    slides: slides ?? [],
    versions: versions ?? [],
  });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = [
    "title", "audience", "objective", "decision_required",
    "language_mode", "presentation_mode", "target_slide_count",
    "target_duration_min", "confidentiality_level", "brand_kit_id", "status", "blueprint",
  ];
  const filtered: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) filtered[k] = patch[k];
  if (!Object.keys(filtered).length) return fail("invalid_input", "no changes", 400);

  if (isDemoContext(ctx)) {
    const updated = await updateDemoProject(params.id, filtered as any);
    if (!updated) return notFound("project");
    return json({ project: updated });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("pq_presentation_projects")
    .update(filtered)
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .select()
    .single();
  if (error) return fail("update_failed", error.message, 500);
  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "project.update",
    object_type: "project", object_id: params.id, metadata: { fields: Object.keys(filtered) },
  });
  return json({ project: data });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!["owner", "admin"].includes(ctx.role)) return fail("forbidden", "owner/admin only", 403);
  if (isDemoContext(ctx)) {
    const ok = await deleteDemoProject(params.id);
    return ok ? json({ ok: true }) : notFound("project");
  }
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("pq_presentation_projects")
    .delete()
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId);
  if (error) return fail("delete_failed", error.message, 500);
  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "project.delete",
    object_type: "project", object_id: params.id,
  });
  return json({ ok: true });
}
