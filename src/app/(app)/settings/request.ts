import { apiRequestError } from "@/lib/request-error";

export interface EditableProfile {
  full_name?: string;
  avatar_url?: string | null;
}

export async function saveProfileRequest(profile: EditableProfile, fallback: string): Promise<{ demo: boolean; profile: EditableProfile }> {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: profile.full_name, avatar_url: profile.avatar_url }),
  });
  if (!response.ok) throw new Error(await apiRequestError(response, fallback));
  const result = await response.json().catch(() => null);
  if (!result || typeof result.full_name !== "string" || !(result.avatar_url === null || typeof result.avatar_url === "string")) {
    throw new Error(fallback);
  }
  const demo = result.demo === true && result.persisted === false;
  if (!demo && (result.demo === true || result.persisted === false)) throw new Error(fallback);
  return { demo, profile: { full_name: result.full_name, avatar_url: result.avatar_url } };
}
