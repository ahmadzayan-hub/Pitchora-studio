/** Safe public error contract: never expose provider bodies, keys or source prompts. */
export type ProviderFailureCode = "model_unavailable" | "provider_rate_or_quota_limit" | "provider_budget_limit" | "provider_authentication" | "provider_permission" | "provider_unavailable" | "provider_timeout" | "generation_cancelled" | "provider_invalid_response" | "provider_request_invalid";
export class ProviderFailure extends Error {
  constructor(public readonly code: ProviderFailureCode, public readonly retryAfterSeconds?: number) { super(code); this.name = "ProviderFailure"; }
}
export function publicGenerationFailure(error: unknown) {
  if (!(error instanceof ProviderFailure)) return { code: "generation_failed", message: "Generation stopped. Check sources and provider availability; existing work is preserved.", status: 422 };
  const messages: Record<ProviderFailureCode, string> = {
    model_unavailable: "Configured model is unavailable. It may be retired, unknown or inaccessible; an owner must verify the model setting. Existing work is preserved.",
    provider_rate_or_quota_limit: "Provider rate or quota limit reached. No automatic retry, model switch or paid fallback was attempted. Existing work is preserved.",
    provider_budget_limit: "Provider spending or credit limit reached. No purchase or fallback was attempted. Existing work is preserved.",
    provider_authentication: "Provider authentication failed. Ask the owner to check configuration securely; do not send keys in chat.",
    provider_permission: "Configured provider access is not permitted. No permissions were expanded.",
    provider_unavailable: "Provider is temporarily unavailable. Existing work is preserved; no substitute output was generated.",
    provider_timeout: "Provider timed out. Existing work is preserved; no automatic retry was attempted.",
    generation_cancelled: "Generation cancelled. Existing work is preserved.",
    provider_invalid_response: "Provider returned an invalid or empty response. No completed output was accepted.",
    provider_request_invalid: "Provider rejected the request. Check the configured model and request limits; existing work is preserved.",
  };
  return { code: error.code, message: messages[error.code], status: error.code === "provider_rate_or_quota_limit" ? 429 : error.code === "generation_cancelled" ? 408 : 503 };
}
