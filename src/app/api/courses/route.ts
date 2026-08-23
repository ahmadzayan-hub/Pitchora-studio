import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { demoReturn } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("courses"); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", user.id)
    .order("starred", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const body = await req.json();
    return NextResponse.json({ id: `course-${Date.now()}`, user_id: "demo-user", ...body, created_at: new Date().toISOString() }, { status: 201 });
  }
  const body = await req.json();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
