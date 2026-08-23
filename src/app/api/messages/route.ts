export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { demoReturn, isDemoMode, DEMO_MESSAGES, DEMO_USER } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("messages");
  if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`to_id.eq.${user.id},from_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (isDemoMode) {
    return NextResponse.json({
      id: `msg-${Date.now()}`,
      thread_id: `thread-${Date.now()}`,
      from_id: DEMO_USER.id,
      from_name: "Sara Al-Mansouri",
      from_role: "student",
      to_id: body.to_id ?? "instructor-001",
      subject: body.subject,
      body: body.body,
      read: true,
      course_id: body.course_id ?? null,
      course_name: body.course_name ?? null,
      created_at: new Date().toISOString(),
      ai_summary: null,
      ai_reply_suggestion_en: null,
      ai_reply_suggestion_ar: null,
    }, { status: 201 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ ...body, from_id: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
