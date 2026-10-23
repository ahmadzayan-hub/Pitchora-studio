import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { DEMO_DEADLINES, isDemoMode } from "@/lib/demo";
import { deadlineCreateSchema, withDeadlineRisk } from "@/lib/deadline-risk";

export async function GET(req: NextRequest) {
  const now = Date.now();
  const view = req.nextUrl.searchParams.get("view") ?? "week";
  if (isDemoMode) {
    let deadlines = DEMO_DEADLINES.map(deadline => ({ ...withDeadlineRisk(deadline, now), is_completed: deadline.is_done }));
    const days = view === "today" ? 1 : view === "week" ? 7 : view === "month" ? 30 : null;
    if (days !== null) deadlines = deadlines.filter(deadline => Date.parse(deadline.due_date) <= now + days * 86400000);
    if (view === "at_risk") deadlines = deadlines.filter(deadline => deadline.risk === "at_risk" || deadline.risk === "overdue");
    return NextResponse.json(deadlines);
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = await createClient();
    let q = supabase.from("deadlines").select("*, courses(name)").eq("user_id", user.id).eq("is_done", false).order("due_date");
    if (view === "today") q = q.lte("due_date", new Date(now + 86400000).toISOString());
    else if (view === "week") q = q.lte("due_date", new Date(now + 7 * 86400000).toISOString());
    else if (view === "month") q = q.lte("due_date", new Date(now + 30 * 86400000).toISOString());
    else if (view === "at_risk") q = q.lt("due_date", new Date(now + 3 * 86400000).toISOString());
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "Unable to load deadlines" }, { status: 500 });
    return NextResponse.json(data?.map((d: any) => ({ ...withDeadlineRisk(d, now), is_completed: d.is_done, course_name: (d.courses as any)?.name ?? "" })) ?? []);
  } catch {
    return NextResponse.json({ error: "Unable to load deadlines" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  const parsed = deadlineCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid deadline", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const deadline = { id: `dl-${now}`, user_id: "demo-user", is_done: false, ...body, created_at: new Date(now).toISOString() };
    return NextResponse.json({ ...withDeadlineRisk(deadline, now), is_completed: deadline.is_done, demo: true, persisted: false }, { status: 201 });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("deadlines").insert({ ...body, user_id: user.id }).select().single();
    if (error || !data) return NextResponse.json({ error: "Unable to create deadline" }, { status: 500 });
    return NextResponse.json({ ...withDeadlineRisk(data, now), is_completed: data.is_done }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create deadline" }, { status: 500 });
  }
}
