import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { DEMO_DEADLINES } from "@/lib/demo";
import { deadlineUpdateSchema, withDeadlineRisk } from "@/lib/deadline-risk";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  const now = Date.now();
  const parsed = deadlineUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid deadline", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const existing = DEMO_DEADLINES.find(deadline => deadline.id === params.id);
    const dueDate = body.due_date ?? existing?.due_date;
    if (!dueDate) return NextResponse.json({ error: "Deadline not found" }, { status: 404 });
    const deadline = { ...existing, ...body, id: params.id, due_date: dueDate, is_done: body.is_done ?? existing?.is_done ?? false };
    return NextResponse.json({ ...withDeadlineRisk(deadline, now), is_completed: deadline.is_done, demo: true, persisted: false });
  }

  try {
    const { data, error } = await supabase
      .from("deadlines")
      .update(body)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) {
      const missing = !error || error.code === "PGRST116";
      return NextResponse.json({ error: missing ? "Deadline not found" : "Unable to update deadline" }, { status: missing ? 404 : 400 });
    }
    return NextResponse.json({ ...withDeadlineRisk(data, now), is_completed: data.is_done });
  } catch {
    return NextResponse.json({ error: "Unable to update deadline" }, { status: 500 });
  }
}
