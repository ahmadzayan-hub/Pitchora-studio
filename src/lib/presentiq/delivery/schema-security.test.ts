import { describe, expect, it } from "vitest";
import { DeliveryProjectSchema, SourceSchema } from "./project";
function oversized(length: number) { const list = new Array(length); Object.defineProperty(list, "0", { get() { throw new Error("Oversized collection traversed"); } }); return list; }
describe("bounded source project collections", () => {
  it("rejects oversized page collections before reading page contents", () => {
    const parsed = SourceSchema.safeParse({ id: "source", name: "Synthetic", text: "Synthetic text", pages: oversized(201) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toHaveLength(1);
  });
  it("rejects oversized sources and scenes before refinements", () => {
    const parsed = DeliveryProjectSchema.safeParse({ format: "pitchora-source-project-v1", title: "Synthetic", language: "en", sources: oversized(11), scenes: oversized(31) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toHaveLength(2);
  });
});
