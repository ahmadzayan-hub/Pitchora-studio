export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { isDemoMode } from "@/lib/demo";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (isDemoMode) return NextResponse.json({ id: params.id, ...body });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .update(body)
    .eq("id", params.id)
    .eq("to_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
