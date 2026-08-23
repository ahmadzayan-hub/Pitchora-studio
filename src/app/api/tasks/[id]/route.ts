export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";

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
    .from("tasks")
    .update(body)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return new NextResponse(null, { status: 204 });
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  await supabase.from("tasks").delete().eq("id", params.id).eq("user_id", user.id);
  return new NextResponse(null, { status: 204 });
}
