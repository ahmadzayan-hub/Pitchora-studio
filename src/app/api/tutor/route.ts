import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { demoReturn } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("tutor-chats"); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("tutor_chats").select("id, title, created_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { course_id } = await req.json();
    return NextResponse.json({ id: `chat-${Date.now()}`, user_id: "demo-user", course_id: course_id || null, title: "New chat", created_at: new Date().toISOString() }, { status: 201 });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { course_id } = await req.json();
  const supabase = await createClient();
  const { data, error } = await supabase.from("tutor_chats").insert({ user_id: user.id, course_id: course_id || null, title: "New chat" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
