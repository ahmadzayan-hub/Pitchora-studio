import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), apiKey: vi.fn(), database: vi.fn(), insert: vi.fn(), from: vi.fn(), update: vi.fn(), detect: vi.fn(), reconstruct: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/services/auth", () => ({ requireUserOrg: mocks.auth, requireApiKey: mocks.apiKey }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true, env: {} }));
vi.mock("@/lib/demo", () => ({ isDemoMode: false, DEMO_USER: {} }));
vi.mock("@/lib/db/supabase-server", () => ({ createClient: mocks.database }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.database }));
vi.mock("@/lib/services/orchestration", () => ({ detectIntent: mocks.detect }));
vi.mock("@/lib/services/clarification", () => ({ findGaps: vi.fn(), generateQuestions: vi.fn() }));
vi.mock("@/lib/services/formatter", () => ({ reconstructPrompt: mocks.reconstruct, postFormatForModel: (value: string) => value }));
import { POST as saveAnswers } from "./sessions/[id]/answers/route";
import { POST as enhance } from "./extension/enhance/route";
import { POST as enhanceV1 } from "./v1/enhance/route";
import { POST as createTemplate } from "./templates/route";
import { POST as signUp } from "./auth/signup/route";

const request = (body: unknown) => new NextRequest("https://pitchora.test/api/test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const context = { params: Promise.resolve({ id: "session" }) };
const validAnswer = { question_id: "8fe477ca-ac1b-403e-8ee5-731f464980ca", answer: "No date is known." };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user", orgId: "org" });
  mocks.apiKey.mockResolvedValue({ userId: "user", orgId: "org" });
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), insert: mocks.insert, update: mocks.update };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({ data: { id: "template" }, error: null });
  query.maybeSingle.mockResolvedValue({ data: { id: "session" }, error: null });
  mocks.insert.mockReturnValue(query);
  mocks.update.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.database.mockResolvedValue({ from: mocks.from, auth: { signUp: mocks.signUp } });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.detect.mockResolvedValue({ intent: "writing" });
  mocks.reconstruct.mockResolvedValue({ final_prompt: "A draft", rationale: "A rationale" });
});

describe("legacy API validation after the Zod security upgrade", () => {
  it("accepts ordinary signup input with a plus-address email", async () => {
    const input = { name: "Synthetic User", email: "synthetic+fixture@example.invalid", password: "fixture-only-not-a-secret" };
    expect((await signUp(request(input))).status).toBe(201);
    expect(mocks.signUp).toHaveBeenCalledWith({ email: input.email, password: input.password, options: { data: { full_name: input.name } } });
  });

  it("retains signup's serialized validation-error envelope without calling auth", async () => {
    const response = await signUp(request({ name: "Synthetic User", email: "not-an-email", password: "fixture-only-not-a-secret" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.parse(body.error)).toEqual([expect.objectContaining({ path: ["email"], message: expect.any(String) })]);
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it("preserves answers at the batch limit", async () => {
    const response = await saveAnswers(request({ answers: Array.from({ length: 100 }, () => validAnswer) }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, count: 100 });
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it("rejects oversized answer batches with one field error and no database access", async () => {
    const response = await saveAnswers(request({ answers: Array(101).fill(null) }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body", issues: { formErrors: [], fieldErrors: { answers: [expect.any(String)] } } });
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([{ answers: [] }, { answers: [{ ...validAnswer, question_id: "invalid" }] }, { answers: [{ ...validAnswer, answer: "" }] }])("retains empty-batch, UUID and answer checks %#", async ({ answers }) => {
    const response = await saveAnswers(request({ answers }), context);
    expect(response.status).toBe(400);
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([{ qa: undefined }, { qa: Array.from({ length: 100 }, () => ({ question: "When?", answer: "Unknown" })) }])("preserves optional and bounded extension clarifications %#", async ({ qa }) => {
    const response = await enhance(request({ raw_prompt: "Write an email", qa }));
    expect(response.status).toBe(200);
    expect(mocks.reconstruct).toHaveBeenCalledWith(expect.objectContaining({ qa: qa ?? [] }), "generic");
  });

  it("rejects oversized extension clarifications before any provider call", async () => {
    const response = await enhance(request({ raw_prompt: "Write an email", qa: Array(101).fill(null) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body", issues: { formErrors: [], fieldErrors: { qa: [expect.any(String)] } } });
    expect(mocks.detect).not.toHaveBeenCalled();
    expect(mocks.reconstruct).not.toHaveBeenCalled();
  });

  it("preserves omitted template bodies and their normalized defaults", async () => {
    const response = await createTemplate(request({ name: "Untitled" }));
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ body: { sections: [], slots: [], defaults: {} }, is_public: false }));
  });

  it("preserves invalid-template error shape", async () => {
    const response = await createTemplate(request({ name: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body", issues: { formErrors: [], fieldErrors: { name: [expect.any(String)] } } });
    expect(mocks.database).not.toHaveBeenCalled();
  });
});

 describe("versioned enhancement validation", () => {
  it("retains the stable v1 valid payload", async () => {
    expect((await enhanceV1(request({ raw_prompt: "Draft a plan" }))).status).toBe(200);
    expect(mocks.reconstruct).toHaveBeenCalledOnce();
  });
  it("bounds v1 clarifications before provider work", async () => {
    const response = await enhanceV1(request({ raw_prompt: "Draft a plan", qa: Array(101).fill(null) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body", issues: { formErrors: [], fieldErrors: { qa: [expect.any(String)] } } });
    expect(mocks.detect).not.toHaveBeenCalled();
  });
});
