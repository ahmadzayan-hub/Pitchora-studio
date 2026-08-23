import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { demoDeadlines } from "@/lib/demo";

export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get("view") ?? "week";
  const demo = demoDeadlines(view); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  let q = supabase.from("deadlines").select("*, courses(name)").eq("user_id", user.id).eq("is_done", false).order("due_date");
  if (view === "today") q = q.lte("due_date", new Date(Date.now() + 86400000).toISOString());
  else if (view === "week") q = q.lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString());
  else if (view === "month") q = q.lte("due_date", new Date(Date.now() + 30 * 86400000).toISOString());
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.map((d: any) => ({ ...d, course_name: (d.courses as any)?.name ?? "" })) ?? []);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const body = await req.json();
    return NextResponse.json({ id: `dl-${Date.now()}`, user_id: "demo-user", risk: "safe", is_done: false, ...body, created_at: new Date().toISOString() }, { status: 201 });
  }
  const body = await req.json();
  const supabase = await createClient();
  const { data, error } = await supabase.from("deadlines").insert({ ...body, user_id: user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
