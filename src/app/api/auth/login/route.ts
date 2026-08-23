export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { isDemoMode, DEMO_USER } from "@/lib/demo";

export async function POST(req: NextRequest) {
  if (isDemoMode) {
    // In demo mode, any credentials succeed — return the demo user
    return NextResponse.json({ user: { id: DEMO_USER.id, email: DEMO_USER.email }, demo: true });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return NextResponse.json({ user: data.user });
}
