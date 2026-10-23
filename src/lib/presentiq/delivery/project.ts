import { z } from "zod";
import type { EvidenceItem, Slide } from "../types";
import { extractiveSlides } from "../ai/extractive";
import { sourceEvidence } from "../evidence/source-ledger";

const xmlText = () => z.string().regex(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]*$/u, "Unsupported control character in text");
export const SourceSchema = z.object({ id: xmlText().min(1).max(80), name: xmlText().min(1).max(200), text: xmlText().min(8).max(100_000), pages: z.array(z.object({ number: z.number().int().min(1).max(200), text: xmlText().max(100_000) }).strict()).max(200).optional() }).strict();
export const SceneSchema = z.object({ title: xmlText().trim().min(1).max(160), text: xmlText().trim().min(1).max(600), evidenceId: xmlText().max(100), seconds: z.number().finite().min(2).max(120), reviewed: z.boolean() }).strict();
export const DeliveryProjectSchema = z.object({
  format: z.literal("pitchora-source-project-v1"), title: xmlText().min(2).max(200), language: z.enum(["en", "ar"]),
  sources: z.array(SourceSchema).min(1).max(10), scenes: z.array(SceneSchema).min(1).max(30),
}).strict().refine(p => p.sources.reduce((n, s) => n + s.text.length, 0) <= 200_000, "Source character limit exceeded")
  .refine(p => new Set(p.sources.map(s => s.id)).size === p.sources.length, "Duplicate source identity")
  .refine(p => p.scenes.reduce((n, s) => n + s.seconds, 0) <= 600, "Video limit is ten minutes");
export type DeliveryProject = z.infer<typeof DeliveryProjectSchema>;
export type Source = z.infer<typeof SourceSchema>;
export function projectEvidence(sources: Source[]): EvidenceItem[] {
  return sources.flatMap(source => sourceEvidence({ fileId: source.id, text: source.text, pages: source.pages, status: "extracted", warnings: [] }, "local")
    .map((item, index) => ({ ...item, id: `${source.id}:${index}` })));
}
export function composeProject(title: string, language: "en" | "ar", sources: Source[]): DeliveryProject {
  sources.forEach(s => SourceSchema.parse(s));
  const evidence = projectEvidence(sources);
  const slides = extractiveSlides({ title, language_mode: language, presentation_mode: "training", target_slide_count: 13, target_duration_min: 5, confidentiality_level: "internal" }, evidence).slice(1);
  return DeliveryProjectSchema.parse({ format: "pitchora-source-project-v1", title, language, sources,
    scenes: slides.map(s => ({ title: s.title_en!, text: s.content_json.kind === "bullets" ? s.content_json.bullets.join("\n") : "", evidenceId: s.evidence_refs![0], seconds: 8, reviewed: false })) });
}
export function reviewProject(project: DeliveryProject): string[] {
  const parsed = DeliveryProjectSchema.safeParse(project);
  if (!parsed.success) return ["Invalid project structure or limits"];
  if (project.sources.some(source => source.pages && (new Set(source.pages.map(p => p.number)).size !== source.pages.length || source.pages.map(p => p.text).join("\n\n") !== source.text))) return ["Source page/text mismatch"];
  const evidence = new Map(projectEvidence(project.sources).map(e => [e.id, e]));
  return project.scenes.flatMap((scene, index) => {
    const issues: string[] = [];
    const e = evidence.get(scene.evidenceId);
    if (!e) issues.push(`Scene ${index + 1}: missing source`);
    if (!scene.reviewed) issues.push(`Scene ${index + 1}: human review required`);
    // Edited interpretation is allowed after explicit review, but unsupported numbers are not.
    const numbers = (text: string) => text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).match(/-?\d+(?:[.,]\d+)*/g) ?? [];
    const supported = new Set(numbers(e?.claim ?? ""));
    if (numbers(`${scene.title} ${scene.text}`).some(n => !supported.has(n))) issues.push(`Scene ${index + 1}: unsupported number`);
    return issues;
  });
}
export function deliverySlides(project: DeliveryProject): Slide[] {
  const evidence = new Map(projectEvidence(project.sources).map(e => [e.id, e]));
  return project.scenes.map((scene, i) => {
    const e = evidence.get(scene.evidenceId);
    const source = project.sources.find(s => s.id === e?.source_file_id);
    const citation = `${source?.name ?? "Missing source"} · ${e?.source_reference?.page ? `page ${e.source_reference.page} · ` : ""}text ${e?.source_reference?.span?.join("–") ?? "unknown"}`;
    return { slide_number: i + 1, title_en: scene.title, ...(project.language === "ar" ? { title_ar: scene.title } : {}),
      content_json: { kind: "bullets", bullets: scene.text.split("\n") }, evidence_refs: [scene.evidenceId],
      speaker_notes_en: `${citation}\nOriginal source excerpt: ${e?.claim ?? ""}\nHuman review: ${scene.reviewed ? "checked by author" : "pending"}. Source truth not independently verified.`, status: "generated" };
  });
}
