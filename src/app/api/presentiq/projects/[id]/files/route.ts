import { sourceEvidence } from "@/lib/presentiq/evidence/source-ledger";
import { randomUUID } from "node:crypto";
import { extractFromBuffer, getRequestContext, getSupabase, isDemoContext, scanForInjection, writeAudit, sanitiseForAgent } from "@/lib/presentiq";
import { fail, json, notFound } from "@/lib/presentiq/api/response";

const MAX = 10 * 1024 * 1024; // 10 MB

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

  // A sample workspace must never pretend that uploaded sources were processed.
  if (isDemoContext(ctx)) return fail("source_storage_unavailable", "Connect an authenticated workspace before uploading sources. No file was processed or saved.", 503);
  if (!["owner", "admin", "editor"].includes(ctx.role)) return fail("forbidden", "Editor access required", 403);

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
  if (files.length > 5 || files.reduce((n, f) => n + f.size, 0) > MAX) return fail("upload_limit", "At most five files and 10 MB per request", 413);

  const created: any[] = [];
  for (const file of files) {
    if (file.size > MAX) {
      created.push({ filename: file.name, error: "file_too_large" });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());

    const fileId = randomUUID();
    const extracted = await extractFromBuffer(fileId, file.name, file.type, buf);
    if (extracted.status !== "extracted") {
      created.push({ filename: file.name, error: extracted.status, warnings: extracted.warnings });
      continue;
    }
    const safePath = `org/${ctx.orgId}/projects/${params.id}/sources/${fileId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("pq-uploads").upload(safePath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      created.push({ filename: file.name, error: "upload_failed" });
      continue;
    }

    const inj = scanForInjection(extracted.text);
    const status = inj.ok ? "clean" : "blocked";

    const { data: row, error: insertError } = await supabase
      .from("pq_source_files")
      .insert({
        id: fileId,
        organization_id: ctx.orgId,
        project_id: params.id,
        filename: file.name,
        file_type: file.type,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: safePath,
        extracted_text: status === "clean" ? sanitiseForAgent(extracted.text) : null,
        extracted_metadata: { numbers: extracted.numbers, dates: extracted.dates, pages: extracted.pages, extraction_status: extracted.status, warnings: extracted.warnings },
        ingestion_status: "done",
        injection_check_status: status,
        confidentiality_level: project.confidentiality_level,
      })
      .select()
      .single();

    if (insertError || !row) {
      await supabase.storage.from("pq-uploads").remove([safePath]);
      created.push({ filename: file.name, error: "source_save_failed" });
      continue;
    }
    if (status === "clean") {
      const items = sourceEvidence(extracted, params.id).map(item => ({ ...item, organization_id: ctx.orgId }));
      const evidenceError = items.length ? (await supabase.from("pq_evidence_items").insert(items)).error : new Error("no_source_passages");
      if (evidenceError) {
        await supabase.from("pq_source_files").update({ ingestion_status: "failed" }).eq("id", row.id).eq("organization_id", ctx.orgId);
        created.push({ id: row.id, filename: file.name, error: "evidence_save_failed" });
        continue;
      }
    }

    await writeAudit(supabase, {
      organization_id: ctx.orgId, user_id: ctx.userId,
      action: status === "clean" ? "file.upload" : "security.injection_detected",
      object_type: "source_file", object_id: row?.id, metadata: { filename: file.name, size: file.size },
    });

    created.push({ id: row?.id, filename: file.name, status });
  }

  return json({ items: created }, { status: created.every(item => item.error) ? 422 : 200 });
}
