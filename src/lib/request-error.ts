/** Prefer actionable validation details over the API's generic error label. */
export async function apiRequestError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  const formErrors = Array.isArray(body?.details?.formErrors) ? body.details.formErrors : [];
  const fieldErrors = Object.values(body?.details?.fieldErrors ?? {}).flat();
  const details = [...fieldErrors, ...formErrors].filter(
    (message): message is string => typeof message === "string" && message.length > 0,
  );
  if (details.length) return details.join(" ");
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}
