import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildDeck } from "../pptx/theme";
import { loadBrandContext } from "../brand/governance";
import { addTitle, renderSlideBody } from "../pptx/layouts";
import type { Slide } from "../types";

describe("patched export dependency compatibility", () => {
  it("exports the legacy layout with a real embedded PNG and editable text", async () => {
    const ctx = loadBrandContext(null, "training", "en");
    const pptx = await buildDeck(ctx, "Dependency regression");
    const slide = pptx.addSlide({ masterName: "PQ_CONTENT" });
    const model: Slide = { slide_number: 1, title_en: "Source evidence", content_json: { kind: "bullets", bullets: ["A supplied source, not an invented claim"] }, status: "generated" };
    addTitle(slide, model, ctx); renderSlideBody(slide, model.content_json, ctx);
    slide.addImage({ data: "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA7kAAAAASUVORK5CYII=", x: 11, y: 5, w: .5, h: .5 });
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: "arraybuffer" }));
    expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toContain("Source evidence");
    const media = Object.keys(zip.files).filter(path => path.startsWith("ppt/media/") && path.endsWith(".png"));
    expect(media.length).toBeGreaterThan(0);
    expect((await zip.file(media[0])!.async("uint8array")).slice(1, 4)).toEqual(new Uint8Array([80, 78, 71]));
  });
});
