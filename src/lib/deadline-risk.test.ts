import { describe, expect, it } from "vitest";
import { deadlineCreateSchema, deadlineUpdateSchema, getDeadlineRisk, withDeadlineRisk } from "./deadline-risk";

const NOW = Date.parse("2026-10-23T12:00:00.000Z");
const DAY = 86_400_000;
const due = (offset: number) => new Date(NOW + offset).toISOString();

describe("deadline risk", () => {
  it.each([
    [-1, "overdue"],
    [0, "at_risk"],
    [3 * DAY - 1, "at_risk"],
    [3 * DAY, "due_soon"],
    [7 * DAY - 1, "due_soon"],
    [7 * DAY, "safe"],
    [30 * DAY, "safe"],
  ])("keeps the strict SQL boundary at offset %i", (offset, expected) => {
    expect(getDeadlineRisk(due(Number(offset)), NOW)).toBe(expected);
  });

  it("advances risk without rewriting the deadline", () => {
    const deadline = { due_date: due(8 * DAY), risk: "safe", is_done: true };
    expect(withDeadlineRisk(deadline, NOW).risk).toBe("safe");
    expect(withDeadlineRisk(deadline, NOW + 2 * DAY).risk).toBe("due_soon");
    expect(withDeadlineRisk(deadline, NOW + 6 * DAY).risk).toBe("at_risk");
    expect(withDeadlineRisk(deadline, NOW + 9 * DAY)).toEqual({ ...deadline, risk: "overdue" });
    expect(deadline.risk).toBe("safe");
    expect(deadline.is_done).toBe(true);
  });

  it("accepts equivalent timezone offsets", () => {
    expect(getDeadlineRisk("2026-10-23T16:00:00+04:00", NOW)).toBe("at_risk");
  });

  it("rejects invalid timestamps rather than incorrectly declaring them safe", () => {
    expect(() => getDeadlineRisk("not a date", NOW)).toThrow(RangeError);
    expect(() => getDeadlineRisk(due(0), NaN)).toThrow(RangeError);
  });
});

describe("deadline writes", () => {
  it("strips client risk, ownership, IDs, creation times, and unsupported fields", () => {
    expect(deadlineCreateSchema.parse({
      title: "Exam", due_date: due(DAY), course_id: "", is_done: false,
      risk: "safe", user_id: "another-user", id: "forged-id", created_at: "yesterday", weight: null,
    })).toEqual({ title: "Exam", due_date: due(DAY), course_id: null, is_done: false });
  });

  it("accepts partial updates and normalizes the existing timeline completion field", () => {
    expect(deadlineUpdateSchema.parse({ is_completed: true, risk: "safe" })).toEqual({ is_done: true });
    expect(deadlineUpdateSchema.parse({ is_done: false })).toEqual({ is_done: false });
    expect(deadlineUpdateSchema.parse({ is_done: true, is_completed: true })).toEqual({ is_done: true });
  });

  it.each([
    {}, { risk: "safe" }, { due_date: "invalid" }, { is_done: "false" },
    { is_completed: "false" }, { is_completed: true, is_done: false }, { type: "unexpected" },
  ])("rejects empty or malformed updates: %j", input => {
    expect(deadlineUpdateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects supplied weights rather than pretending unsupported data was saved", () => {
    const parsed = deadlineCreateSchema.safeParse({ title: "Exam", due_date: due(DAY), weight: 20 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ path: ["weight"], message: "Deadline weight is not supported" }));
  });

  it("requires a title and due date on creation", () => {
    expect(deadlineCreateSchema.safeParse({ title: "Exam" }).success).toBe(false);
    expect(deadlineCreateSchema.safeParse({ title: " ", due_date: due(DAY) }).success).toBe(false);
    expect(deadlineCreateSchema.safeParse({ title: "Exam", due_date: "2026-10-24T12:00" }).success).toBe(true);
  });
});
