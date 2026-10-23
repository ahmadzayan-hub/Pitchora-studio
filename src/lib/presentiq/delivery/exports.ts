import type { DeliveryProject } from "./project";
import { deliverySlides, reviewProject, projectEvidence } from "./project";
import { loadBrandContext } from "../brand/governance";
import { buildDeck } from "../pptx/theme";


export async function deliveryPptx(project: DeliveryProject): Promise<ArrayBuffer> {
  const issues = reviewProject(project);
  if (issues.length) throw new Error(issues[0]);
  const ctx = loadBrandContext(null, "training", project.language);
  const pptx = await buildDeck(ctx, project.title);
  const refs = projectEvidence(project.sources);
  const slides = deliverySlides(project);
  const rtl = project.language === "ar";
  for (const [i, scene] of project.scenes.entries()) {
    // Direct editable text preserves all reviewed lines. Legacy bullet layouts truncate.
    const slide = pptx.addSlide();
    slide.background = { color: "0A0E2A" };
    const textStyle = { fontFace: rtl ? "Noto Sans Arabic" : "Arial", color: "F2F4FF", align: rtl ? "right" : "left", rtlMode: rtl, margin: 0, breakLine: false };
    slide.addText(project.title, { ...textStyle, x: .7, y: .35, w: 11.9, h: .45, fontSize: 14, color: "A5B4FC", fit: "shrink" });
    slide.addText(scene.title, { ...textStyle, x: .7, y: 1.1, w: 11.9, h: 1.2, fontSize: 34, bold: true, fit: "shrink", valign: "mid" });
    slide.addShape(pptx.ShapeType.rect, { x: .7, y: 2.5, w: 11.9, h: .025, line: { color: "6366F1" }, fill: { color: "6366F1" } });
    slide.addText(scene.text, { ...textStyle, x: .7, y: 2.85, w: 11.9, h: 3.25, fontSize: 25, fit: "shrink", valign: "top", paraSpaceAfterPt: 8 });
    const ref = refs.find(r => r.id === scene.evidenceId);
    const source = project.sources.find(s => s.id === ref?.source_file_id);
    const citation = `${source?.name ?? "Source"}${ref?.source_reference?.page ? ` · p.${ref.source_reference.page}` : ""} · ${ref?.source_reference?.span?.join("–") ?? ""}`;
    slide.addText(citation, { ...textStyle, x: .7, y: 6.5, w: 10.8, h: .55, fontSize: 12, color: "C7CBEF", fit: "shrink" });
    slide.addText(`${i + 1} / ${project.scenes.length}`, { x: 11.6, y: 6.6, w: 1, h: .3, fontSize: 12, color: "C7CBEF", align: "right", margin: 0 });
    slide.addNotes(slides[i].speaker_notes_en);
  }
  return await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
}
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Standalone presentation, no remote scripts/fonts/tracking or embedded source-file bytes. */
export function deliveryHtml(project: DeliveryProject): string {
  const issues = reviewProject(project); if (issues.length) throw new Error(issues[0]);
  const slides = deliverySlides(project);
  return `<!doctype html><html lang="${project.language}" dir="${project.language === "ar" ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(project.title)}</title><style>body{margin:0;background:#0a0e2a;color:#f2f4ff;font:24px/1.6 Arial,sans-serif}section{box-sizing:border-box;min-height:100vh;padding:8vh 10vw;border-bottom:1px solid #6366f1;break-after:page}h1{font-size:clamp(28px,5vw,60px)}p{white-space:pre-wrap;overflow-wrap:anywhere}small{display:block;color:#c7cbef;font-size:16px}nav{position:fixed;bottom:1rem;inset-inline-end:1rem}button{font:inherit;padding:.3rem 1rem} @media print{nav{display:none}section{height:100vh;min-height:0}body{background:white;color:#111}small{color:#333}} @media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}</style><nav aria-label="Presentation controls"><button onclick="window.print()">Print / PDF</button></nav>${project.scenes.map((s, i) => `<section id="scene-${i + 1}"><small>${escape(project.title)} · ${i + 1}/${project.scenes.length}</small><h1>${escape(s.title)}</h1><p>${escape(s.text)}</p><small>${escape(slides[i].speaker_notes_en ?? "")}</small></section>`).join("")}</html>`;
}
export function deliveryTimeline(project: DeliveryProject) {
  if (reviewProject(project).length) throw new Error("Review required");
  return { format: "pitchora-motion-v1", width: 1920, height: 1080, fps: 30, timing: "manual_cues_not_speech_alignment", scenes: project.scenes.map((s, i) => ({ page: i + 1, seconds: s.seconds })), narration: "none_supplied" };
}
