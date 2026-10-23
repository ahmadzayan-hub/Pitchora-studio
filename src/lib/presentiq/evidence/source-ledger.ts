import type { EvidenceItem, Slide } from "../types";
import type { ExtractedDoc } from "./extractors";

/** Offsets refer to the stored, normalized page text, never the original PDF byte stream. */
export function sourceEvidence(doc: ExtractedDoc, projectId: string): Omit<EvidenceItem, "id">[] {
  if (doc.status !== "extracted") return [];
  const pages = doc.pages?.length ? doc.pages : [{ number: undefined, text: doc.text }];
  const result: Omit<EvidenceItem, "id">[] = [];
  for (const page of pages) {
    for (const match of page.text.matchAll(/[^\n]+?(?:[.!?؟](?=\s|$)|(?=\n)|$)/gu)) {
      const raw = match[0];
      const claim = raw.trim();
      if (claim.length < 8) continue;
      const start = (match.index ?? 0) + raw.indexOf(claim);
      // Long passages remain whole in the source. Split only at whitespace, retaining exact offsets.
      let offset = 0;
      while (offset < claim.length) {
        let end = Math.min(offset + 320, claim.length);
        if (end < claim.length) {
          const space = claim.lastIndexOf(" ", end);
          if (space > offset) end = space;
        }
        const chunk = claim.slice(offset, end);
        const leading = chunk.length - chunk.trimStart().length;
        const part = chunk.trim();
        if (part) result.push({
          project_id: projectId, source_file_id: doc.fileId, claim: part,
          classification: "user_input", confidence: 0,
          source_reference: { file_id: doc.fileId, ...(page.number ? { page: page.number } : {}), span: [start + offset + leading, start + offset + leading + part.length] },
        });
        offset = end;
        while (offset < claim.length && /\s/u.test(claim[offset])) offset++;
        if (result.length >= 300) return result;
      }
    }
  }
  return result;
}

/** This checks traceability and number preservation, not factual truth or entailment. */
export function reviewGrounding(slides: Slide[], evidence: EvidenceItem[], allowedTitle?: string): string[] {
  const byId = new Map(evidence.map(e => [e.id, e]));
  const findings: string[] = [];
  for (const slide of slides) {
    if (slide.slide_number === 1 && slide.content_json.kind === "cover" && allowedTitle && slide.content_json.title === allowedTitle &&
        (!slide.title_en || slide.title_en === allowedTitle) && (!slide.title_ar || slide.title_ar === allowedTitle) &&
        (!slide.content_json.subtitle || slide.content_json.subtitle === "Source-led draft · human review required") &&
        !slide.content_json.date && !slide.key_message_en && !slide.key_message_ar) continue;
    const refs = slide.evidence_refs ?? [];
    if (!refs.length) findings.push(`Slide ${slide.slide_number}: source reference required`);
    if (refs.some(id => !byId.has(id))) findings.push(`Slide ${slide.slide_number}: unknown source reference`);
    const source = refs.map(id => byId.get(id)?.claim ?? "").join(" ");
    const text = [slide.title_en, slide.title_ar, slide.key_message_en, slide.key_message_ar,
      JSON.stringify(slide.content_json)].filter(Boolean).join(" ");
    // Normalize Arabic digits; do not infer percentages, totals, deltas or unit conversions.
    const numbers = (value: string) => (value.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).match(/-?\d+(?:[.,]\d+)*/g) ?? []);
    const supported = new Set(numbers(source));
    if (numbers(text).some(n => !supported.has(n))) findings.push(`Slide ${slide.slide_number}: number not present in cited source`);
  }
  return findings;
}

export function citationLabel(item: EvidenceItem): string {
  const ref = item.source_reference;
  return `${item.source_file_id ?? ref?.file_id ?? "Source"}${ref?.page ? `, page ${ref.page}` : ""}${ref?.span ? `, text ${ref.span[0]}–${ref.span[1]}` : ""}`;
}
