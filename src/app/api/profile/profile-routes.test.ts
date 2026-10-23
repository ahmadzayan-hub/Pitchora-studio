import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { GET, PUT } from "./route";
import { POST as onboard } from "./onboarding/route";

vi.mock("@/lib/db/supabase-server", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/demo", () => ({ DEMO_PROFILE: { id: "demo-user", full_name: "Demo Student", email: "demo@example.com", avatar_url: null } }));

const user = { id: "user-1", email: "student@example.com" };
const validInput = {
  full_name: "  Student Name  ", program_name: " MBA ", university: " Example University ",
  gpa_scale: "4.0", study_hours_per_week: 15, primary_language: "en", goal: "gpa",
};
let db: any;
let query: any;
let record: Record<string, unknown> | null;
let dbError: { message: string; code?: string } | null;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); }));
  record = { display_name: "Student Name", avatar_url: null, email: user.email };
  dbError = null;
  query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), update: vi.fn(() => query),
    single: vi.fn(async () => ({ data: record, error: dbError })),
  };
  db = { from: vi.fn(() => query), rpc: vi.fn(async () => ({ data: null, error: dbError })) };
  vi.mocked(requireUser).mockResolvedValue({ user, supabase: db, unauthorized: null });
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function request(body: unknown) {
  return new NextRequest("http://localhost/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("profile read/write contract", () => {
  it("maps display_name to the existing full_name response without querying nonexistent columns", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ full_name: "Student Name", avatar_url: null, email: user.email });
    expect(query.select).toHaveBeenCalledWith("display_name, avatar_url, email");
    expect(query.eq).toHaveBeenCalledWith("id", user.id);
  });

  it("maps writable names and accepts but never persists known response metadata", async () => {
    const response = await PUT(request({
      full_name: "  Student Name  ", avatar_url: null, email: user.email, id: "not-the-user", demo: false, persisted: false,
    }));
    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({ display_name: "Student Name", avatar_url: null });
    expect(query.eq).toHaveBeenCalledWith("id", user.id);
    expect(await response.json()).toEqual({ full_name: "Student Name", avatar_url: null, email: user.email });
  });

  it("supports partial avatar updates and clearing an avatar", async () => {
    expect((await PUT(request({ avatar_url: "https://example.com/avatar.png" }))).status).toBe(200);
    expect(query.update).toHaveBeenLastCalledWith({ avatar_url: "https://example.com/avatar.png" });
    expect((await PUT(request({ avatar_url: "" }))).status).toBe(200);
    expect(query.update).toHaveBeenLastCalledWith({ avatar_url: null });
  });

  it.each([
    {}, { email: "student@example.com" }, { full_name: " " }, { full_name: "x".repeat(201) },
    { avatar_url: "javascript:alert(1)" }, { avatar_url: "https://example.com/" + "x".repeat(2048) },
    { full_name: "Student", role: "admin" }, { full_name: "Student", user_id: "other" },
    { full_name: "Student", default_org_id: "other-org" }, { full_name: "Student", display_name: "different" },
  ])("rejects malformed, empty, and privileged profile updates: %j", async input => {
    expect((await PUT(request(input))).status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("blocks unauthenticated reads and writes", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: null, supabase: db, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await GET()).status).toBe(401);
    expect((await PUT(request({ full_name: "Student" }))).status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("sanitizes read/write database errors instead of returning successful empty data", async () => {
    dbError = { message: "secret internal SQL implementation", code: "42703" };
    const read = await GET();
    const write = await PUT(request({ full_name: "Student" }));
    expect(read.status).toBe(500);
    expect(write.status).toBe(500);
    expect(await read.text()).not.toContain(dbError.message);
    expect(await write.text()).not.toContain(dbError.message);
  });

  it("reports a missing profile and handles thrown provider errors safely", async () => {
    record = null;
    expect((await GET()).status).toBe(404);
    query.single.mockRejectedValue(new Error("internal provider details"));
    expect(await (await GET()).json()).toEqual({ error: "Unable to load profile" });
    expect(await (await PUT(request({ full_name: "Student" }))).json()).toEqual({ error: "Unable to save profile" });
  });

  it("labels demo data and writes as non-persistent without invoking the database", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(await (await GET()).json()).toMatchObject({ demo: true, persisted: false });
    expect(await (await PUT(request({ full_name: "Preview Student" }))).json()).toMatchObject({ full_name: "Preview Student", demo: true, persisted: false });
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("atomic onboarding contract", () => {
  it("calls the auth-bound RPC once with normalized mapped values and no caller-supplied ID", async () => {
    const response = await onboard(request(validInput));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("complete_tweenz_onboarding", {
      p_full_name: "Student Name", p_program_name: "MBA", p_university: "Example University",
      p_gpa_scale: 4, p_study_hours: 15, p_primary_language: "en", p_goal: "gpa",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("preserves the alternate grading scale, language, goal, and optional university", async () => {
    const response = await onboard(request({ ...validInput, university: " ", gpa_scale: "100", study_hours_per_week: 0, primary_language: "ar", goal: "research" }));
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("complete_tweenz_onboarding", expect.objectContaining({ p_gpa_scale: 100, p_study_hours: 0, p_primary_language: "ar", p_goal: "research", p_university: "" }));
  });

  it.each([
    { full_name: " " }, { full_name: "x".repeat(201) }, { program_name: "" }, { program_name: "x".repeat(201) },
    { university: "x".repeat(201) }, { gpa_scale: "5.0" }, { gpa_scale: 4 },
    { study_hours_per_week: -1 }, { study_hours_per_week: 169 }, { study_hours_per_week: 2.5 },
    { study_hours_per_week: "15" }, { primary_language: "fr" }, { goal: "admin" },
    { user_id: "another-user" }, { role: "admin" }, { onboarded: true }, { onboarding_completed: true },
  ])("rejects invalid or unknown onboarding inputs before RPC: %j", async invalid => {
    expect((await onboard(request({ ...validInput, ...invalid }))).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("requires authentication before completing onboarding", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: null, supabase: db, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await onboard(request(validInput))).status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns a sanitized failure when the atomic RPC fails, never false success", async () => {
    dbError = { message: "violates internal secret table constraint" };
    const response = await onboard(request(validInput));
    expect(response.status).toBe(500);
    const result = await response.json();
    expect(result).not.toHaveProperty("ok");
    expect(result.error).toBe("Unable to save onboarding. Please try again.");
    db.rpc.mockRejectedValue(new Error("internal details"));
    expect((await onboard(request(validInput))).status).toBe(500);
  });

  it("does not claim persistence or invoke a provider in demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const response = await onboard(request(validInput));
    expect(await response.json()).toEqual({ ok: true, demo: true, persisted: false });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("handles malformed JSON for both writes before any database action", async () => {
    const malformed = () => new NextRequest("http://localhost/api/profile", { method: "POST", body: "{" });
    expect((await PUT(malformed())).status).toBe(400);
    expect((await onboard(malformed())).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
});
