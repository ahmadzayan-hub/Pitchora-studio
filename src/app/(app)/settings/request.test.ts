import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProfileRequest } from "./request";

const profile = { full_name: "Student", avatar_url: null };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("settings profile submission", () => {
  it("reports Saved only for a valid successful response and sends only writable fields", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...profile, email: "student@example.com" }));
    const echoed = { ...profile, email: "student@example.com", id: "user-1", role: "admin" };
    expect(await saveProfileRequest(echoed, "Try again")).toEqual({ demo: false, profile });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PUT", body: JSON.stringify(profile) }));
  });

  it("returns a demo notice rather than Saved for a non-persistent preview", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...profile, demo: true, persisted: false }));
    expect(await saveProfileRequest(profile, "Try again")).toEqual({ demo: true, profile });
  });

  it("reports validation failures without modifying the input", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Invalid profile", details: { fieldErrors: { full_name: ["Name is required"] } } }, { status: 400 }));
    const input = { full_name: " ", avatar_url: null };
    await expect(saveProfileRequest(input, "Try again")).rejects.toThrow("Name is required");
    expect(input).toEqual({ full_name: " ", avatar_url: null });
  });

  it("does not swallow server or network failures", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Unable to save profile" }, { status: 500 }));
    await expect(saveProfileRequest(profile, "Try again")).rejects.toThrow("Unable to save profile");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(saveProfileRequest(profile, "Try again")).rejects.toBeInstanceOf(TypeError);
  });

  it.each([
    null, {}, { error: "Unable to save profile" }, { full_name: 123, avatar_url: null },
    { ...profile, persisted: false }, { ...profile, demo: true },
  ])("rejects unconfirmed success payloads: %j", async result => {
    fetchMock.mockResolvedValue(Response.json(result));
    await expect(saveProfileRequest(profile, "Try again")).rejects.toThrow("Try again");
  });

  it("handles malformed responses with a readable fallback", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not JSON", { status: 200 }));
    await expect(saveProfileRequest(profile, "Try again")).rejects.toThrow("Try again");
  });
});
