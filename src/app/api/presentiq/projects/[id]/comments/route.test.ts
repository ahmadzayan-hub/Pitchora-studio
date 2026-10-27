import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestContext, getSupabase, writeAudit } from "@/lib/presentiq";
import { POST } from "./route";

vi.mock("@/lib/presentiq", () => ({
  getRequestContext: vi.fn(),
  getSupabase: vi.fn(),
  writeAudit: vi.fn(),
  isDemoContext: vi.fn(() => false),
}));

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let inserts: Array<{ table: string; values: Row }>;

function from(table: string) {
  const filters: Array<[string, unknown]> = [];
  const matches = () =>
    (tables[table] ?? []).filter((row) => filters.every(([col, val]) => row[col] === val));
  const query: any = {
    select: () => query,
    eq: (col: string, val: unknown) => { filters.push([col, val]); return query; },
    in: () => query,
    order: () => query,
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    single: async () => ({ data: matches()[0] ?? null, error: null }),
    insert: (values: Row) => {
      inserts.push({ table, values });
      const row = { id: `comment-${inserts.length}`, ...values };
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: matches(), error: null }).then(resolve),
  };
  return query;
}

function post(projectId: string, body: Row) {
  const req = new Request(`http://test/api/presentiq/projects/${projectId}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: projectId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  inserts = [];
  tables = {
    pq_slides: [
      { id: "slide-A", organization_id: "org-1", project_id: "proj-A" },
      { id: "slide-B", organization_id: "org-1", project_id: "proj-B" },
      { id: "slide-C", organization_id: "org-2", project_id: "proj-A" },
    ],
  };
  vi.mocked(getRequestContext).mockResolvedValue({ userId: "user-1", orgId: "org-1", email: "a@b.c", role: "owner" } as any);
  vi.mocked(getSupabase).mockResolvedValue({ from } as any);
  vi.mocked(writeAudit).mockResolvedValue(undefined as any);
});

describe("POST /api/presentiq/projects/[id]/comments", () => {
  it("accepts a comment on a slide that belongs to the project in the URL", async () => {
    const res = await post("proj-A", { slide_id: "slide-A", body: "Looks right" });
    expect(res.status).toBe(201);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values.slide_id).toBe("slide-A");
  });

  it("rejects a comment on a slide that belongs to another project, without inserting", async () => {
    const res = await post("proj-A", { slide_id: "slide-B", body: "Cross-project" });
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("rejects a comment on a slide from another organisation even when the project id matches", async () => {
    const res = await post("proj-A", { slide_id: "slide-C", body: "Cross-tenant" });
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("rejects an unknown slide id", async () => {
    const res = await post("proj-A", { slide_id: "missing", body: "Ghost" });
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });
});
