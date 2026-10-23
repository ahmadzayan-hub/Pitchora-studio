import { describe, it, expect, vi } from "vitest";
import { Orchestrator, loadBrandContext, MemoryAiCache } from "..";
import { ExtractiveProvider, type CompletionRequest } from "../ai/provider";
import { extractiveBlueprint } from "../ai/extractive";
import type { Brief, EvidenceItem } from "../types";
const brief: Brief = { title: "Budget", language_mode: "en", presentation_mode: "training", target_slide_count: 2, target_duration_min: 5, confidentiality_level: "internal" };
const evidence: EvidenceItem[] = [{ id: "e1", project_id: "p", claim: "Budget AED 1200", classification: "user_input", confidence: 0 }];
const ctx = loadBrandContext(null, "training", "en");
const good = { slide_number: 1, title_en: "Budget", content_json: { kind: "bullets", bullets: ["Budget AED 1200"] }, evidence_refs: ["e1"] };
const bad = { ...good, content_json: { kind: "bullets", bullets: ["Budget AED 9900"] } };
function make(responses: unknown[]) {
  const requests: CompletionRequest[] = [];
  const complete = vi.fn(async (req: CompletionRequest) => { requests.push(req); const next = responses.shift(); if (next instanceof Error) throw next; return { text: typeof next === "string" ? next : JSON.stringify(next), model: "test", provider: "test" }; });
  const provider = { name: "test", enterpriseSafe: true, complete, embed: vi.fn() };
  return { orch: new Orchestrator(provider, "org", new MemoryAiCache()), requests, complete };
}
const args = () => ({ brief, evidence, ctx, blueprint: extractiveBlueprint(brief, evidence) });
describe("bounded source model orchestration", () => {
  it("passes actual evidence and repairs unsupported numbers once", async () => {
    const { orch, requests, complete } = make([{ slides: [bad] }, { slides: [] }, { slides: [good] }]);
    const result = await orch.runDeck(args());
    expect(requests[0].userPrompt).toContain("Budget AED 1200");
    expect(requests[0].userPrompt).toContain("e1");
    expect(complete).toHaveBeenCalledTimes(3); expect(result.slides[0].evidence_refs).toEqual(["e1"]);
  });
  it("fails after one unsuccessful repair", async () => {
    const { orch, complete } = make([{ slides: [bad] }, { slides: [] }, { slides: [bad] }]);
    await expect(orch.runDeck(args())).rejects.toThrow("source_grounding_failed"); expect(complete).toHaveBeenCalledTimes(3);
  });
  it.each(["not json", { slides: [] }, new Error("provider unavailable")])("fails explicitly on invalid, empty or failed provider output", async response => {
    const { orch, complete } = make([response]); await expect(orch.runDeck(args())).rejects.toThrow(); expect(complete).toHaveBeenCalledTimes(1);
  });
  it("honors cancellation before free composition", async () => {
    const controller = new AbortController(); controller.abort();
    const orch = new Orchestrator(new ExtractiveProvider(), "org", new MemoryAiCache(), () => {}, controller.signal);
    await expect(orch.runDeck(args())).rejects.toThrow();
  });
});
