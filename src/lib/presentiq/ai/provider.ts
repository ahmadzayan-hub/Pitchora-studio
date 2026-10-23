/**
 * Model provider abstraction.
 *
 * The orchestrator never talks to an SDK directly. It calls
 * `provider.complete(...)` or `provider.embed(...)`. This lets us:
 *   - swap providers per-tenant (confidentiality routing).
 *   - run unit tests with the deterministic mock provider.
 *   - cache outputs by canonical input hash.
 */

import { ProviderFailure } from "./errors";
import type { ConfidentialityLevel } from "../types";

export type CompletionRequest = {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: "json" | "text";
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type CompletionResult = {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
  model: string;
  provider: string;
};

export type EmbedResult = { vector: number[]; model: string; dim: number };

export interface ModelProvider {
  name: string;
  enterpriseSafe: boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  embed(text: string): Promise<EmbedResult>;
}

// ---------------------------------------------------------------------
// Mock provider (always available, deterministic)
// ---------------------------------------------------------------------

export class MockProvider implements ModelProvider {
  name = "mock";
  enterpriseSafe = true;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const text =
      req.responseFormat === "json"
        ? JSON.stringify(buildMockJson(req))
        : `MOCK: ${req.userPrompt.slice(0, 200)}`;
    return {
      text,
      usage: { input_tokens: req.userPrompt.length / 4, output_tokens: text.length / 4 },
      model: "mock-1",
      provider: "mock",
    };
  }

  async embed(text: string): Promise<EmbedResult> {
    // Deterministic 1536-dim pseudo-embedding using a simple hash spread.
    const vec = new Array(1536).fill(0);
    let h = 5381;
    for (const ch of text) h = ((h << 5) + h) ^ ch.charCodeAt(0);
    for (let i = 0; i < 1536; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      vec[i] = ((h & 0xffff) / 0xffff) * 2 - 1;
    }
    return { vector: vec, model: "mock-embed", dim: 1536 };
  }
}

function buildMockJson(req: CompletionRequest): unknown {
  // Returns a shape that matches the most common JSON contracts in the
  // orchestrator — useful for local dev when no real provider is configured.
  if (req.systemPrompt.includes("BRIEF_AGENT")) {
    return {
      title: "Q3 Steering Committee",
      audience: "Executive Director",
      objective: "Decision",
      decision_required: "Approve plan",
      key_message: "Approve Option 2",
      missing_data: [],
    };
  }
  if (req.systemPrompt.includes("EVIDENCE_AGENT")) {
    return { items: [] };
  }
  if (req.systemPrompt.includes("STRATEGY_AGENT") || req.systemPrompt.includes("STORY_AGENT")) {
    return {
      narrative: { hook: "", problem: "", insight: "", solution: "", impact: "", recommendation: "", decision: "" },
    };
  }
  if (req.systemPrompt.includes("ARCHITECT_AGENT")) {
    return { slides: [] };
  }
  if (req.systemPrompt.includes("COPYWRITER_AGENT")) {
    return { slides: [] };
  }
  if (req.systemPrompt.includes("VISUAL_AGENT")) {
    return { slides: [] };
  }
  if (req.systemPrompt.includes("RTL_AGENT") || req.systemPrompt.includes("TRANSLATION_AGENT")) {
    return { slides: [] };
  }
  return {};
}

// ---------------------------------------------------------------------
// Anthropic provider (production)
// ---------------------------------------------------------------------

export class AnthropicProvider implements ModelProvider {
  name = "anthropic";
  enterpriseSafe = true;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly embedFallback?: ModelProvider;

  constructor(opts: { apiKey: string; model?: string; embedFallback?: ModelProvider }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "claude-sonnet-4-6";
    this.embedFallback = opts.embedFallback;
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(this.model)) throw new ProviderFailure("model_unavailable");
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (req.signal?.aborted) throw new ProviderFailure("generation_cancelled");
    const url = "https://api.anthropic.com/v1/messages";
    const body = {
      model: this.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.systemPrompt,
      messages: [{ role: "user", content: req.userPrompt }],
    };

    let res: Response;
    try { res = await fetch(url, {
      method: "POST",
      signal: req.signal ? AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }); } catch (error) {
      if (req.signal?.aborted) throw new ProviderFailure("generation_cancelled");
      if (error instanceof Error && error.name === "TimeoutError") throw new ProviderFailure("provider_timeout");
      throw new ProviderFailure("provider_unavailable");
    }

    if (req.signal?.aborted) throw new ProviderFailure("generation_cancelled");
    if (!res.ok) {
      const retry = Number(res.headers.get("retry-after"));
      if (res.status === 429) throw new ProviderFailure("provider_rate_or_quota_limit", Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) : undefined);
      if (res.status === 404) throw new ProviderFailure("model_unavailable");
      if (res.status === 401) throw new ProviderFailure("provider_authentication");
      if (res.status === 403) throw new ProviderFailure("provider_permission");
      if (res.status === 402) throw new ProviderFailure("provider_budget_limit");
      if (res.status === 504 || res.status === 408) throw new ProviderFailure("provider_timeout");
      if (res.status >= 500) throw new ProviderFailure("provider_unavailable");
      throw new ProviderFailure("provider_request_invalid");
    }
    const data = (await res.json().catch(() => { throw new ProviderFailure("provider_invalid_response"); })) as {
      content: { type: string; text?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (!Array.isArray(data.content)) throw new ProviderFailure("provider_invalid_response");
    const text = data.content.filter((c) => c && c.type === "text" && typeof c.text === "string").map((c) => c.text ?? "").join("\n");
    if (!text.trim()) throw new ProviderFailure("provider_invalid_response");
    return {
      text,
      usage: data.usage,
      model: this.model,
      provider: "anthropic",
    };
  }

  async embed(text: string): Promise<EmbedResult> {
    // Anthropic does not currently expose a public embeddings endpoint of its own.
    // Only an explicitly supplied, separately approved embedding provider may run.
    if (!this.embedFallback) throw new Error("embedding_provider_required");
    return this.embedFallback.embed(text);
  }
}

// ---------------------------------------------------------------------
// Resolver: picks the right provider for a confidentiality tier.
// ---------------------------------------------------------------------

export type ProviderResolverOptions = {
  preferred?: "anthropic" | "mock" | "extractive";
  apiKey?: string;
  model?: string;
  allowed?: string[]; // organisation-allowed providers
  confidentiality?: ConfidentialityLevel;
};

export function resolveProvider(opts: ProviderResolverOptions = {}): ModelProvider {
  const preferred = opts.preferred ?? "extractive";
  const allowed = opts.allowed ?? ["anthropic", "extractive"];

  if (preferred === "anthropic" && allowed.includes("anthropic") && opts.apiKey) {
    return new AnthropicProvider({ apiKey: opts.apiKey, model: opts.model });
  }
  if (preferred === "mock" && allowed.includes("mock")) return new MockProvider();
  if (preferred === "extractive" && allowed.includes("extractive")) return new ExtractiveProvider();
  throw new Error("provider_disallowed");
}

/** Marker for the free source-copying path. Never synthesizes model responses. */
export class ExtractiveProvider implements ModelProvider {
  name = "extractive";
  enterpriseSafe = true;
  async complete(_req: CompletionRequest): Promise<CompletionResult> { throw new Error("extractive_action_unsupported"); }
  async embed(_text: string): Promise<EmbedResult> { throw new Error("embedding_provider_required"); }
}
