import type { OnboardingData } from "@/lib/profile-input";
import { apiRequestError } from "@/lib/request-error";

export async function saveOnboarding(data: OnboardingData, fallback: string): Promise<{ demo: boolean }> {
  const response = await fetch("/api/profile/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await apiRequestError(response, fallback));
  const result = await response.json().catch(() => null);
  if (result?.ok !== true) throw new Error(fallback);
  if (result.demo === true && result.persisted === false) return { demo: true };
  if (result.demo === true || result.persisted === false) throw new Error(fallback);
  return { demo: false };
}
