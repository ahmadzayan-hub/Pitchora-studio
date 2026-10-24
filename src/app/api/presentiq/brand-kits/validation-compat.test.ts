import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/presentiq", () => ({ getRequestContext: async () => ({ orgId: "synthetic", role: "editor" }), isDemoContext: () => true, getSupabase: vi.fn(), writeAudit: vi.fn() }));
vi.mock("@/lib/presentiq/demo/store", () => ({ createBrandKit: mocks.create, listBrandKits: vi.fn() }));
import { POST } from "./route";
const request = (body: unknown) => new Request("https://pitchora.test/api/presentiq/brand-kits", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockImplementation(async value => ({ ...value, id: "synthetic" })); });
describe("v4 brand-kit records", () => {
  it("preserves arbitrary string keys and values", async () => {
    const colors = { custom: "#123456", "accent-2": "navy" };
    const fonts = { ar: "Dubai", en: "Arial" };
    const response = await POST(request({ name: "Synthetic", colors, fonts }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ colors, fonts }));
  });
  it("preserves optional record defaults", async () => {
    expect((await POST(request({ name: "Synthetic" }))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ colors: {}, fonts: {} }));
  });
  it("rejects non-string values before creating a kit", async () => {
    const response = await POST(request({ name: "Synthetic", colors: { accent: 42 } }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toHaveProperty("colors.accent");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
