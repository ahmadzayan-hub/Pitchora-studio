import { describe, it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { composeProject, reviewProject, DeliveryProjectSchema } from "./project";
import { deliveryHtml, deliveryPptx, deliveryTimeline } from "./exports";
const source = { id: "f1", name: "budget.txt", text: "Budget is AED 12400000. Actual cost is AED 11000000." };
const draft = () => composeProject("Budget review", "en", [source]);
const reviewed = () => { const p = draft(); p.scenes.forEach(s => s.reviewed = true); return p; };
describe("source studio delivery", () => {
  it("requires author review, then accepts known sources", () => {
    expect(reviewProject(draft()).length).toBe(2);
    expect(reviewProject(reviewed())).toEqual([]);
  });
  it("validates backup roundtrip and rejects fabricated source references", () => {
    const p = DeliveryProjectSchema.parse(JSON.parse(JSON.stringify(reviewed())));
    expect(p).toEqual(reviewed()); p.scenes[0].evidenceId = "other:1";
    expect(reviewProject(p).join(" ")).toContain("missing source");
  });
  it("blocks source-unbacked numbers even after checkbox review", () => {
    const p = reviewed(); p.scenes[0].text = "Savings 99%";
    expect(reviewProject(p).join(" ")).toContain("unsupported number");
  });
  it("validates duration, duplicate identity and unknown project fields", () => {
    const p = reviewed(); p.scenes[0].seconds = Number.NaN;
    expect(DeliveryProjectSchema.safeParse(p).success).toBe(false);
    expect(DeliveryProjectSchema.safeParse({ ...reviewed(), script: "anything" }).success).toBe(false);
    expect(DeliveryProjectSchema.safeParse({ ...reviewed(), sources: [source, source] }).success).toBe(false);
  });
  it("exports genuine editable PPTX with source values and notes", async () => {
    const buffer = await deliveryPptx(reviewed()); const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain("12400000"); expect(xml).toContain("<a:t>");
    const notes = await zip.file("ppt/notesSlides/notesSlide1.xml")!.async("string");
    expect(notes).toContain("budget.txt"); expect(notes).toContain("Original source excerpt");
    if (process.env.PITCHORA_FIXTURE_DIR) {
      const dir = process.env.PITCHORA_FIXTURE_DIR;
      await mkdir(dir, { recursive: true });
      const project = composeProject("مراجعة المصادر · Source review", "ar", [{ id: "ar-source", name: "synthetic-arabic.txt", text: "تكلفة المشروع ١٢٠٠ درهم. المبلغ المتبقي ٣٠٠ درهم." }]);
      project.scenes.forEach(s => { s.reviewed = true; s.seconds = 2; });
      await writeFile(join(dir, "deck.pptx"), new Uint8Array(await deliveryPptx(project)));
      await writeFile(join(dir, "timeline.json"), JSON.stringify(deliveryTimeline(project)));
    }

  });
  it("escapes hostile source text in standalone HTML", () => {
    const p = reviewed(); p.scenes[0].text = '<img src=x onerror="alert()">';
    const html = deliveryHtml(p);
    expect(html).not.toContain('<img src=x'); expect(html).toContain('&lt;img');
    expect(html).not.toContain('https://');
  });
  it("does not label an export package as rendered video or invent narration", () => {
    const timeline = deliveryTimeline(reviewed());
    expect(timeline.narration).toBe("none_supplied");
    expect(timeline.timing).toBe("manual_cues_not_speech_alignment");
  });
  it("preserves every reviewed line and rejects invalid XML control characters", async () => {
    const p = reviewed(); p.scenes[0].text = "Alpha\nBeta\nGamma\nDelta\nEpsilon\nZeta\nFinal line";
    const zip = await JSZip.loadAsync(await deliveryPptx(p));
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain("Final line"); expect(xml).toContain("budget.txt");
    p.scenes[0].text = "bad\u000btext";
    expect(DeliveryProjectSchema.safeParse(p).success).toBe(false);
    await expect(deliveryPptx(p)).rejects.toThrow();
  });
  it("does not export unreviewed output", async () => {
    expect(() => deliveryHtml(draft())).toThrow();
    await expect(deliveryPptx(draft())).rejects.toThrow();
  });
});
