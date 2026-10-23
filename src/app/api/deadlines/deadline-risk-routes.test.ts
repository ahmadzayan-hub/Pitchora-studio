import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient, getUser, requireUser } from "@/lib/db/supabase-server";
import { aiChat } from "@/lib/ai/client";
import { GET, POST } from "./route";
import { PUT } from "./[id]/route";
import { POST as askMba } from "../ask-mba/route";
import { POST as weeklyBrief } from "../weekly-brief/route";
import { GET as exportAccount } from "../account/export/route";

vi.mock("@/lib/db/supabase-server", () => ({ createClient: vi.fn(), getUser: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ aiChat: vi.fn() }));
vi.mock("@/lib/demo", () => ({
  get isDemoMode() { return process.env.NEXT_PUBLIC_DEMO_MODE === "true"; },
  DEMO_DEADLINES: [{ id: "demo-1", due_date: "2026-10-22T12:00:00.000Z", risk: "safe", is_done: false }],
  demoReturn: vi.fn(() => null),
}));

const NOW = Date.parse("2026-10-23T12:00:00.000Z");
const DAY = 86_400_000;
const due = (days: number) => new Date(NOW + days * DAY).toISOString();
const user = { id: "user-1" };
let rows: Record<string, any[]>;
let writtenRow: Record<string, any> | null;
let selections: Array<{ table: string; columns: string | undefined }>;
let writes: Array<{ table: string; values: Record<string, any> }>;
let filters: any[][];
let dbError: { message: string } | null;

function from(table: string) {
  const query: any = {
    select: vi.fn((columns?: string) => { selections.push({ table, columns }); return query; }),
    insert: vi.fn((values: Record<string, any>) => { writes.push({ table, values }); return query; }),
    update: vi.fn((values: Record<string, any>) => { writes.push({ table, values }); return query; }),
    eq: vi.fn((...args: any[]) => { filters.push([table, "eq", ...args]); return query; }),
    lt: vi.fn((...args: any[]) => { filters.push([table, "lt", ...args]); return query; }),
    lte: vi.fn((...args: any[]) => { filters.push([table, "lte", ...args]); return query; }),
    gte: vi.fn(() => query), neq: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query),
    single: vi.fn(async () => ({ data: writtenRow, error: dbError })),
    then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows[table] ?? [], error: dbError }).then(resolve, reject),
  };
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  // These route tests must never call a real provider, database, or HTTP server.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); }));
  rows = { deadlines: [{ id: "deadline-1", title: "Exam", due_date: due(-1), risk: "safe", is_done: false, courses: { name: "Finance" } }] };
  writtenRow = { ...rows.deadlines[0] };
  selections = []; writes = []; filters = []; dbError = null;
  const db = { from: vi.fn(from) };
  vi.mocked(createClient).mockResolvedValue(db as any);
  vi.mocked(getUser).mockResolvedValue(user as any);
  vi.mocked(requireUser).mockResolvedValue({ user, supabase: db, unauthorized: null } as any);
  vi.mocked(aiChat).mockResolvedValue("{}");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(path = "/api/deadlines", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function expectNoRiskColumnSelect() {
  for (const { columns } of selections.filter(selection => selection.table === "deadlines")) {
    expect(columns?.split(",").map(column => column.trim())).not.toContain("risk");
  }
}

describe("deadline response risk", () => {
  it("recomputes legacy GET risks at the same instant and keeps response fields", async () => {
    rows.deadlines.push({ id: "deadline-2", due_date: due(3), risk: "at_risk", is_done: false });
    const response = await GET(request("/api/deadlines?view=week"));
    expect(await response.json()).toEqual([
      { ...rows.deadlines[0], risk: "overdue", is_completed: false, course_name: "Finance" },
      { ...rows.deadlines[1], risk: "due_soon", is_completed: false, course_name: "" },
    ]);
    expect(filters).toContainEqual(["deadlines", "eq", "user_id", user.id]);
    expect(filters).toContainEqual(["deadlines", "eq", "is_done", false]);
    expect(filters).toContainEqual(["deadlines", "lte", "due_date", due(7)]);
  });

  it("supports rows from fresh schemas that have no risk column", async () => {
    delete rows.deadlines[0].risk;
    const response = await GET(request("/api/deadlines?view=all"));
    expect((await response.json())[0]).toMatchObject({ id: "deadline-1", risk: "overdue" });
    expect(rows.deadlines[0]).not.toHaveProperty("risk");
  });

  it("filters the at-risk view by the strict due-date boundary, not a stored column", async () => {
    await GET(request("/api/deadlines?view=at_risk"));
    expect(filters).toContainEqual(["deadlines", "lt", "due_date", due(3)]);
    expectNoRiskColumnSelect();
  });

  it("derives POST risk from saved data while stripping all server-owned fields", async () => {
    const response = await POST(request(undefined, {
      title: "Exam", due_date: due(-1), risk: "safe", user_id: "other", id: "forged", created_at: "yesterday",
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).risk).toBe("overdue");
    expect(writes).toEqual([{ table: "deadlines", values: { title: "Exam", due_date: due(-1), user_id: user.id } }]);
  });

  it("keeps completion separate from risk on PUT and scopes the update", async () => {
    writtenRow!.is_done = true;
    const response = await PUT(request(undefined, { is_completed: true, risk: "safe", user_id: "other" }), { params: Promise.resolve({ id: "deadline-1" }) });
    expect(await response.json()).toMatchObject({ is_done: true, is_completed: true, risk: "overdue" });
    expect(writes).toEqual([{ table: "deadlines", values: { is_done: true } }]);
    expect(filters).toContainEqual(["deadlines", "eq", "id", "deadline-1"]);
    expect(filters).toContainEqual(["deadlines", "eq", "user_id", user.id]);
  });

  it("uses the captured response timestamp even if the database read spans a boundary", async () => {
    rows.deadlines = [
      { id: "before", due_date: due(3), is_done: false },
      { id: "after", due_date: due(3), is_done: false },
    ];
    vi.mocked(createClient).mockImplementationOnce(async () => {
      vi.setSystemTime(NOW + DAY);
      return { from: vi.fn(from) } as any;
    });
    const response = await GET(request("/api/deadlines?view=all"));
    expect((await response.json()).map((deadline: any) => deadline.risk)).toEqual(["due_soon", "due_soon"]);
  });

  it("returns the new due date's risk after a due date edit", async () => {
    writtenRow!.due_date = due(7);
    const response = await PUT(request(undefined, { due_date: due(7) }), { params: Promise.resolve({ id: "deadline-1" }) });
    expect((await response.json()).risk).toBe("safe");
  });

  it("rejects risk-only and malformed writes before reaching the database", async () => {
    const put = await PUT(request(undefined, { risk: "safe" }), { params: Promise.resolve({ id: "deadline-1" }) });
    const post = await POST(request(undefined, { title: "Exam", due_date: "invalid" }));
    const malformed = await POST(new NextRequest("http://localhost/api/deadlines", { method: "POST", body: "{" }));
    expect([put.status, post.status, malformed.status]).toEqual([400, 400, 400]);
    expect(writes).toHaveLength(0);
  });

  it("accepts blank form weights but reports populated weights as unsupported", async () => {
    const blank = await POST(request(undefined, { title: "Exam", due_date: due(1), weight: null }));
    const populated = await POST(request(undefined, { title: "Exam", due_date: due(1), weight: 20 }));
    expect(blank.status).toBe(201);
    expect(writes[0].values).not.toHaveProperty("weight");
    expect(populated.status).toBe(400);
    expect((await populated.json()).details.fieldErrors.weight).toEqual(["Deadline weight is not supported"]);
  });

  it("keeps unauthenticated reads and creation blocked", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request(undefined, { title: "Exam", due_date: due(1) }))).status).toBe(401);
    expect(selections).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("preserves the existing database error responses", async () => {
    dbError = { message: "database unavailable" };
    expect((await GET(request())).status).toBe(500);
    expect((await POST(request(undefined, { title: "Exam", due_date: due(1) }))).status).toBe(500);
    expect((await PUT(request(undefined, { is_done: true }), { params: Promise.resolve({ id: "deadline-1" }) })).status).toBe(400);
  });

  it("sanitizes database errors and does not return success for a missing saved row", async () => {
    dbError = { message: "secret internal database details" };
    expect(await (await POST(request(undefined, { title: "Exam", due_date: due(1) }))).json()).toEqual({ error: "Unable to create deadline" });
    expect(await (await GET(request())).json()).toEqual({ error: "Unable to load deadlines" });
    expect(await (await PUT(request(undefined, { is_done: true }), { params: Promise.resolve({ id: "deadline-1" }) })).json()).toEqual({ error: "Unable to update deadline" });
    dbError = null;
    writtenRow = null;
    expect((await POST(request(undefined, { title: "Exam", due_date: due(1) }))).status).toBe(500);
    expect((await PUT(request(undefined, { is_done: true }), { params: Promise.resolve({ id: "deadline-1" }) })).status).toBe(404);
  });

  it("handles thrown database-client failures without a successful write response", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("internal details"));
    expect((await GET(request())).status).toBe(500);
    const response = await POST(request(undefined, { title: "Exam", due_date: due(1) }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to create deadline" });
    vi.mocked(requireUser).mockResolvedValue({ user, supabase: { from: () => { throw new Error("internal details"); } }, unauthorized: null } as any);
    expect((await PUT(request(undefined, { is_done: true }), { params: Promise.resolve({ id: "deadline-1" }) })).status).toBe(500);
  });

  it("refreshes demo GET, POST, and PUT risk without trusting client labels", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const get = await GET(request("/api/deadlines?view=at_risk"));
    expect(await get.json()).toEqual([{ id: "demo-1", due_date: due(-1), risk: "overdue", is_done: false, is_completed: false }]);
    const post = await POST(request(undefined, { title: "Exam", due_date: due(3), risk: "safe" }));
    expect(await post.json()).toMatchObject({ risk: "due_soon", demo: true, persisted: false });
    const put = await PUT(request(undefined, { is_completed: true, risk: "safe" }), { params: Promise.resolve({ id: "demo-1" }) });
    expect(await put.json()).toMatchObject({ id: "demo-1", risk: "overdue", is_done: true, is_completed: true, demo: true, persisted: false });
    expect(writes).toHaveLength(0);
  });
});

describe("deadline risk in downstream consumers", () => {
  it("adds fresh risk to Ask MBA context without selecting the removed column", async () => {
    await askMba(request("/api/ask-mba", { query: "What is due?" }));
    expect(vi.mocked(aiChat).mock.calls[0][0][1].content).toContain("Risk: overdue");
    expectNoRiskColumnSelect();
  });

  it("adds fresh risk to the weekly brief context", async () => {
    await weeklyBrief();
    expect(vi.mocked(aiChat).mock.calls[0][0][1].content).toContain('"risk":"overdue"');
    expect(filters).toContainEqual(["deadlines", "lte", "due_date", due(14)]);
    expectNoRiskColumnSelect();
  });

  it("refreshes exported risks, including completed rows, without mutating stored data", async () => {
    rows.deadlines[0].is_done = true;
    const response = await exportAccount();
    const exported = await response.json();
    expect(exported.exported_at).toBe(new Date(NOW).toISOString());
    expect(exported.deadlines[0]).toMatchObject({ risk: "overdue", is_done: true });
    expect(rows.deadlines[0].risk).toBe("safe");
    expect(response.headers.get("Content-Disposition")).toContain(`tweenz-data-${NOW}.json`);
    expectNoRiskColumnSelect();
  });
});
