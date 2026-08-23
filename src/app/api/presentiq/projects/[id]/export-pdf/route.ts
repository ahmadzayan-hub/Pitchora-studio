import { getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { fail, json, notFound, unauthorized } from "@/lib/presentiq/api/response";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";

export const runtime = "nodejs";
export const maxDuration = 240;

/**
 * PDF export.
 *
 * Strategy: download the latest PPTX render, run LibreOffice headless to convert.
 * If LibreOffice is unavailable in the deployment, returns 503 — the UI surfaces
 * a clear "PDF unavailable on this plan" message. Server-side conversion can be
 * delegated to a managed worker for production.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const supabase = await getSupabase();

  const { data: latest } = await supabase
    .from("pq_deck_versions")
    .select("*")
    .eq("project_id", params.id)
    .eq("organization_id", ctx.orgId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.pptx_path) return notFound("pptx");

  const { data: file, error } = await supabase.storage.from("pq-renders").download(latest.pptx_path);
  if (error || !file) return fail("download_failed", error?.message ?? "missing", 500);

  const dir = await fs.mkdtemp(join(tmpdir(), "pq-pdf-"));
  const inputPath = join(dir, "deck.pptx");
  const outputPath = join(dir, "deck.pdf");
  await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

  try {
    await runLibreOffice(inputPath, dir);
  } catch (e) {
    return fail("pdf_unavailable", "PDF conversion not available on this server", 503, { detail: (e as Error).message });
  }

  const pdfBuf = await fs.readFile(outputPath).catch(() => null);
  if (!pdfBuf) return fail("pdf_missing", "conversion produced no output", 500);

  const path = latest.pptx_path.replace(/\.pptx$/i, ".pdf");
  await supabase.storage.from("pq-renders").upload(path, pdfBuf, { contentType: "application/pdf", upsert: true });
  const { data: signed } = await supabase.storage.from("pq-renders").createSignedUrl(path, 3600 * 24);

  await supabase
    .from("pq_deck_versions")
    .update({ pdf_url: signed?.signedUrl, pdf_path: path })
    .eq("id", latest.id);

  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "project.export.pdf",
    object_type: "deck_version", object_id: latest.id,
  });

  return json({ url: signed?.signedUrl, path });
}

function runLibreOffice(input: string, outDir: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("soffice", ["--headless", "--convert-to", "pdf", "--outdir", outDir, input], {
      timeout: 120_000,
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => reject(e));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`soffice_exit_${code}: ${stderr.slice(0, 200)}`))));
  });
}
