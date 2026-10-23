import type { Blueprint, Brief, EvidenceItem, Slide } from "../types";
import { citationLabel } from "../evidence/source-ledger";

/** A useful free, deterministic composer. It copies evidence; it is not an LLM or fact verifier. */
export function extractiveBlueprint(brief: Brief, evidence: EvidenceItem[]): Blueprint {
  if (!evidence.length) throw new Error("source_required");
  const selected = evidence.slice(0, Math.max(1, brief.target_slide_count - 1));
  return {
    objective: brief.objective ?? "Review the supplied sources",
    audience_logic: brief.audience ?? "Audience not specified",
    key_message: brief.title,
    storyline: selected.map(e => e.claim),
    recommended_structure: [
      { slide_number: 1, title: brief.title, purpose: "Cover" },
      ...selected.map((e, i) => ({ slide_number: i + 2, title: e.claim.split(/\s+/).slice(0, 8).join(" "), purpose: `Source excerpt: ${e.id}` })),
    ],
    missing_data: ["Human source accuracy, interpretation and visual review required.",
      ...(brief.language_mode === "bilingual" ? ["Free composition preserves source language; bilingual translation is not generated."] : []),
      ...(evidence.length > selected.length ? [`${evidence.length - selected.length} further source passages are not selected in this draft.`] : [])],
  };
}

export function extractiveSlides(brief: Brief, evidence: EvidenceItem[]): Slide[] {
  const blueprint = extractiveBlueprint(brief, evidence);
  const selected = evidence.slice(0, Math.max(1, brief.target_slide_count - 1));
  return [{ slide_number: 1, title_en: brief.title, content_json: { kind: "cover", title: brief.title, subtitle: "Source-led draft · human review required" }, status: "generated" },
    ...selected.map((e, i): Slide => ({
      slide_number: i + 2, title_en: blueprint.recommended_structure[i + 1].title,
      ...(brief.language_mode === "ar" ? { title_ar: blueprint.recommended_structure[i + 1].title } : {}),
      purpose: "Verbatim source excerpt; not independently verified",
      content_json: { kind: "bullets", bullets: [e.claim] }, evidence_refs: [e.id],
      speaker_notes_en: `SOURCE: ${citationLabel(e)}\nEXCERPT: ${e.claim}\nUnverified user-provided evidence.`, status: "generated",
    }))];
}
