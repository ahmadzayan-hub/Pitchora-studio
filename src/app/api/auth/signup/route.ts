export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { isDemoMode, DEMO_USER } from "@/lib/demo";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  if (isDemoMode) {
    // In demo mode, any registration instantly succeeds — redirect to dashboard
    return NextResponse.json({ user: { id: DEMO_USER.id, email: DEMO_USER.email }, demo: true }, { status: 201 });
  }

  let body: any;
  try { body = schema.parse(await req.json()); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { full_name: body.name } },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user }, { status: 201 });
}
