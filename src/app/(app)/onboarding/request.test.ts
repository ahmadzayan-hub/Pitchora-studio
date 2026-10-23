import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingData } from "@/lib/profile-input";
import { saveOnboarding } from "./request";

const input: OnboardingData = {
  full_name: "Student", program_name: "MBA", university: "", gpa_scale: "4.0",
  study_hours_per_week: 15, primary_language: "en", goal: "gpa",
};
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("onboarding client submission", () => {
  it("permits dashboard navigation only after confirmed saved success", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    expect(await saveOnboarding(input, "Try again")).toEqual({ demo: false });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/onboarding", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });

  it("reports actionable non-OK validation errors instead of returning success", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Invalid onboarding data", details: { fieldErrors: { full_name: ["Name is required"] } } }, { status: 400 }));
    await expect(saveOnboarding(input, "Try again")).rejects.toThrow("Name is required");
  });

  it("does not swallow server or network failures", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Unable to save onboarding" }, { status: 500 }));
    await expect(saveOnboarding(input, "Try again")).rejects.toThrow("Unable to save onboarding");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(saveOnboarding(input, "Try again")).rejects.toBeInstanceOf(TypeError);
  });

  it("returns a demo notice instead of saved-success navigation", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, demo: true, persisted: false }));
    expect(await saveOnboarding(input, "Try again")).toEqual({ demo: true });
  });

  it.each([{}, { ok: false }, { ok: true, persisted: false }, { ok: true, demo: true }])("rejects unconfirmed success payloads: %j", async result => {
    fetchMock.mockResolvedValue(Response.json(result));
    await expect(saveOnboarding(input, "Try again")).rejects.toThrow("Try again");
  });

  it("rejects malformed success and error responses with a readable fallback", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not JSON", { status: 200 }));
    await expect(saveOnboarding(input, "Try again")).rejects.toThrow("Try again");
    fetchMock.mockResolvedValueOnce(new Response("Gateway error", { status: 502 }));
    await expect(saveOnboarding(input, "Try again")).rejects.toThrow("Try again");
  });
});
