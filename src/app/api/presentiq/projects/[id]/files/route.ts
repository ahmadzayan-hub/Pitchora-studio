import { randomUUID } from "node:crypto";
import { extractFromBuffer, getRequestContext, getSupabase, isDemoContext, scanForInjection, writeAudit, sanitiseForAgent, heuristicClassify } from "@/lib/presentiq";
import { fail, json, notFound } from "@/lib/presentiq/api/response";

const MAX = 50 * 1024 * 1024; // 50 MB

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (isDemoContext(ctx)) return json({ items: [] });
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("pq_source_files")
    .select("id,filename,file_type,size_bytes,ingestion_status,injection_check_status,created_at")
    .eq("organization_id", ctx.orgId)
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });
  return json({ items: data ?? [] });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();

  // Demo path — accept files but skip persistence; return their metadata.
  if (isDemoContext(ctx)) {
    const form = await req.formData().catch(() => null);
    if (!form) return fail("invalid_form", "expected multipart form", 400);
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    return json({
      items: files.map((f) => ({ id: randomUUID(), filename: f.name, status: "clean" })),
    });
  }

  const supabase = await getSupabase();

  const { data: project } = await supabase
    .from("pq_presentation_projects")
    .select("id, confidentiality_level")
    .eq("id", params.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!project) return notFound("project");

  const form = await req.formData().catch(() => null);
  if (!form) return fail("invalid_form", "expected multipart form", 400);

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return fail("missing_file", "at least one file", 400);

  const created: any[] = [];
  for (const file of files) {
    if (file.size > MAX) {
      created.push({ filename: file.name, error: "file_too_large" });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());

    const safePath = `org/${ctx.orgId}/projects/${params.id}/sources/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("pq-uploads").upload(safePath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      created.push({ filename: file.name, error: "upload_failed", detail: upErr.message });
      continue;
    }

    const extracted = await extractFromBuffer(randomUUID(), file.name, file.type, buf);
    const inj = scanForInjection(extracted.text);
    const status = inj.ok ? "clean" : "blocked";

    const { data: row } = await supabase
      .from("pq_source_files")
      .insert({
        organization_id: ctx.orgId,
        project_id: params.id,
        filename: file.name,
        file_type: file.type,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: safePath,
        extracted_text: status === "clean" ? sanitiseForAgent(extracted.text) : null,
        extracted_metadata: { numbers: extracted.numbers, dates: extracted.dates },
        ingestion_status: "done",
        injection_check_status: status,
        confidentiality_level: project.confidentiality_level,
      })
      .select()
      .single();

    // Auto-create heuristic evidence items for sentences containing numbers.
    if (status === "clean" && row && extracted.text) {
      await seedEvidence(supabase, ctx.orgId, params.id, row.id, extracted.text);
    }

    await writeAudit(supabase, {
      organization_id: ctx.orgId, user_id: ctx.userId,
      action: status === "clean" ? "file.upload" : "security.injection_detected",
      object_type: "source_file", object_id: row?.id, metadata: { filename: file.name, size: file.size },
    });

    created.push({ id: row?.id, filename: file.name, status });
  }

  return json({ items: created });
}

async function seedEvidence(supabase: any, orgId: string, projectId: string, fileId: string, text: string) {
  const sentences = splitSentences(text).slice(0, 60);
  const items = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 360 && /\d|[A-Z][a-z]+/.test(s))
    .slice(0, 30)
    .map((claim) => {
      const cls = heuristicClassify(claim);
      return {
        organization_id: orgId,
        project_id: projectId,
        source_file_id: fileId,
        claim,
        classification: cls.classification,
        confidence: cls.confidence,
        source_reference: { file_id: fileId },
      };
    });
  if (!items.length) return;
  await supabase.from("pq_evidence_items").insert(items);
}

function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?؟])\s+/).filter(Boolean);
}
