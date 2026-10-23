import { z } from "zod";

const DAY_MS = 86_400_000;

export type DeadlineRisk = "overdue" | "at_risk" | "due_soon" | "safe";

/** Evaluate against a single timestamp captured by the caller for the response. */
export function getDeadlineRisk(dueDate: string, now: number): DeadlineRisk {
  const due = Date.parse(dueDate);
  if (!Number.isFinite(due) || !Number.isFinite(now)) {
    throw new RangeError("Deadline risk requires valid timestamps");
  }
  if (due < now) return "overdue";
  if (due < now + 3 * DAY_MS) return "at_risk";
  if (due < now + 7 * DAY_MS) return "due_soon";
  return "safe";
}

/** Always override any stale risk returned by a legacy database or demo fixture. */
export function withDeadlineRisk<T extends { due_date: string }>(
  deadline: T,
  now: number,
): Omit<T, "risk"> & { risk: DeadlineRisk } {
  return { ...deadline, risk: getDeadlineRisk(deadline.due_date, now) };
}

// Only actual writable deadline columns are accepted. In particular, risk,
// ownership, IDs, and creation timestamps must never come from the client.
const writableDeadlineFields = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  due_date: z.string().refine(value => Number.isFinite(Date.parse(value)), "Invalid due date"),
  course_id: z.string().nullable().optional().transform(value => value === "" ? null : value),
  type: z.enum(["assignment", "quiz", "exam", "presentation", "project", "reading", "lecture", "admin"]).optional(),
  is_done: z.boolean().optional(),
});

// The timeline UI historically calls this field is_completed. Keep that
// compatibility at the boundary without persisting an unsupported SQL column.
function normalizeDeadlineInput(input: unknown, ctx: z.RefinementCtx): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  // The form sends null when weight is blank; populated weights have never
  // had a backing deadline column and must not be silently reported as saved.
  if (value.weight !== undefined && value.weight !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weight"], message: "Deadline weight is not supported" });
    return z.NEVER;
  }
  if (!("is_completed" in value)) return input;
  if ("is_done" in value && value.is_done !== value.is_completed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Conflicting completion fields" });
    return z.NEVER;
  }
  return { ...value, is_done: value.is_completed };
}

export const deadlineCreateSchema = z.preprocess(normalizeDeadlineInput, writableDeadlineFields);
export const deadlineUpdateSchema = z.preprocess(
  normalizeDeadlineInput,
  writableDeadlineFields.partial().refine(
    value => Object.keys(value).length > 0,
    "No writable deadline fields provided",
  ),
);
