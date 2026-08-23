import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { demoReturn } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("subscription"); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single();
  return NextResponse.json(data);
}
