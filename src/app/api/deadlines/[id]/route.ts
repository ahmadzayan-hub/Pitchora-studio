import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { demoReturn } from "@/lib/demo";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const body = await req.json();
    return NextResponse.json({ id: params.id, ...body });
  }
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  const body = await req.json();

  const { data, error } = await supabase
    .from("deadlines")
    .update(body)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
