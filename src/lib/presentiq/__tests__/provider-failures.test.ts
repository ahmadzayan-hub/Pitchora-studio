import { afterEach, describe, it, expect, vi } from "vitest";
import { AnthropicProvider, resolveProvider } from "../ai/provider";
import { ProviderFailure, publicGenerationFailure } from "../ai/errors";
const request = { systemPrompt: "Synthetic system", userPrompt: "Synthetic evidence only" };
const provider = () => new AnthropicProvider({ apiKey: "fixture-not-a-real-key", model: "claude-sonnet-4-6" });
afterEach(() => vi.unstubAllGlobals());
describe("provider lifecycle and quota failure contract", () => {
  it.each([[404,"model_unavailable"],[429,"provider_rate_or_quota_limit"],[402,"provider_budget_limit"],[401,"provider_authentication"],[403,"provider_permission"],[400,"provider_request_invalid"],[500,"provider_unavailable"],[529,"provider_unavailable"],[504,"provider_timeout"]])("handles HTTP %s without fallback or leaking provider text", async (status,code) => {
    const fetch = vi.fn().mockResolvedValue(new Response("secret-and-source-must-not-leak", { status: status as number, headers: { "retry-after": "15" } })); vi.stubGlobal("fetch",fetch);
    const error = await provider().complete(request).catch(e=>e);
    expect(error).toBeInstanceOf(ProviderFailure); expect(error.code).toBe(code); expect(error.message).not.toContain("secret");
    expect(publicGenerationFailure(error).message).not.toContain("secret"); expect(fetch).toHaveBeenCalledTimes(1);
    if (status===429) expect(error.retryAfterSeconds).toBe(15);
  });
  it("does not infer definite retirement from every 404", () => {
    expect(publicGenerationFailure(new ProviderFailure("model_unavailable")).message).toContain("may be retired, unknown or inaccessible");
  });
  it("classifies network outage and honors cancellation without calls", async () => {
    const fetch=vi.fn().mockRejectedValue(new Error("private connection detail"));vi.stubGlobal("fetch",fetch);
    await expect(provider().complete(request)).rejects.toMatchObject({code:"provider_unavailable"});
    const controller=new AbortController();controller.abort();
    await expect(provider().complete({...request,signal:controller.signal})).rejects.toMatchObject({code:"generation_cancelled"});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed and empty success rather than manufacturing text", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({content:[]}),{status:200})));
    await expect(provider().complete(request)).rejects.toMatchObject({code:"provider_invalid_response"});
  });
  it("keeps default extractive mode even with configured paid model/key", () => {
    expect(resolveProvider({apiKey:"fixture",model:"unavailable-model"}).name).toBe("extractive");
  });
  it("never silently returns mock embeddings", async () => {
    await expect(provider().embed("Synthetic source")).rejects.toThrow("embedding_provider_required");
  });
  it("sends only explicitly selected model and omits removed sampling parameters", async () => {
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({content:[{type:"text",text:"{}"}]}),{status:200}));vi.stubGlobal("fetch",fetch);
    await provider().complete({...request,temperature:0.4});
    const body=JSON.parse(fetch.mock.calls[0][1].body);expect(body.model).toBe("claude-sonnet-4-6");expect(body.temperature).toBeUndefined();
  });
});
