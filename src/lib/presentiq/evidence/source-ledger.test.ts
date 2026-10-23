import { describe, expect, it } from "vitest";
import { sourceEvidence, reviewGrounding } from "./source-ledger";
import { extractiveSlides, extractiveBlueprint } from "../ai/extractive";
import { resolveProvider } from "../ai/provider";
import type { Brief, EvidenceItem } from "../types";
const brief: Brief = { title: "Source report", language_mode: "en", presentation_mode: "training", target_slide_count: 3, target_duration_min: 5, confidentiality_level: "internal" };
const evidence: EvidenceItem[] = [{ id: "e1", project_id: "p", source_file_id: "f", claim: "The supplied budget is AED 12400000.", classification: "user_input", confidence: 0, source_reference: { file_id: "f", page: 2 } }];
describe("source-led composition", () => {
  it("preserves real page and text offsets, including Arabic without numbers", () => {
    const doc = { fileId: "f", text: "unused", status: "extracted" as const, warnings: [], pages: [{ number: 2, text: "  هذه معلومات مهمة من المصدر.\nBudget is AED 12400000." }] };
    const items = sourceEvidence(doc, "p");
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.classification).toBe("user_input"); expect(item.confidence).toBe(0);
      expect(item.source_reference?.page).toBe(2);
      const [start, end] = item.source_reference!.span!;
      expect(doc.pages[0].text.slice(start, end)).toBe(item.claim);
    }
  });
  it("preserves decimal numbers and CSV lines without punctuation", () => {
    const items = sourceEvidence({ fileId: "f", text: "Unit price is AED 12.75.\nItem,Value\nFuel,4500", status: "extracted", warnings: [] }, "p");
    expect(items.map(i => i.claim)).toEqual(["Unit price is AED 12.75.", "Item,Value", "Fuel,4500"]);
  });
  it("does not label plain text as PDF page 1", () => {
    const [item] = sourceEvidence({ fileId: "f", text: "A meaningful source passage.", status: "extracted", warnings: [] }, "p");
    expect(item.source_reference?.page).toBeUndefined();
  });
  it("does not create evidence from failed extraction", () => {
    expect(sourceEvidence({ fileId: "f", text: "", status: "failed", warnings: [] }, "p")).toEqual([]);
  });
  it("copies source values, identifies source, and never supplies invented baseline", () => {
    const slides = extractiveSlides(brief, evidence);
    expect(slides[1].content_json).toEqual({ kind: "bullets", bullets: [evidence[0].claim] });
    expect(slides[1].speaker_notes_en).toContain("page 2");
    expect(reviewGrounding(slides, evidence, brief.title)).toEqual([]);
  });
  it("fails without sources instead of producing mock success", () => {
    expect(() => extractiveBlueprint(brief, [])).toThrow("source_required");
  });
  it("does not quietly select paid inference just because a key exists", () => {
    expect(resolveProvider({ apiKey: "test-key-not-live" }).name).toBe("extractive");
    expect(() => resolveProvider({ preferred: "anthropic" })).toThrow("provider_disallowed");
  });
  it("rejects missing or foreign citations and unsupported numbers", () => {
    const slide = extractiveSlides(brief, evidence)[1];
    expect(reviewGrounding([{ ...slide, evidence_refs: ["other"] }], evidence)).not.toEqual([]);
    expect(reviewGrounding([{ ...slide, content_json: { kind: "bullets", bullets: ["Revenue increased by 48%"] } }], evidence)).toContain("Slide 2: number not present in cited source");
  });
  it("marks source language preservation and omitted evidence honestly", () => {
    const result = extractiveBlueprint({ ...brief, language_mode: "bilingual" }, [...evidence, ...evidence, ...evidence]);
    expect(result.missing_data.join(" ")).toContain("translation is not generated");
    expect(result.missing_data.join(" ")).toContain("not selected");
  });
  it("keeps exact spans across tabs and chunk boundaries", () => {
    const text = "A".repeat(319) + " \t" + "B".repeat(9);
    const items = sourceEvidence({ fileId: "f", text, status: "extracted", warnings: [] }, "p");
    for (const item of items) expect(text.slice(...item.source_reference!.span!)).toBe(item.claim);
  });
});
