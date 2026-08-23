import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { safeRoute } from "@/lib/api-helpers";

export const GET = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("*, questions(*), prompt_versions(*)")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Pull answers separately for clarity
  const { data: answers } = await supabase
    .from("answers")
    .select("*")
    .eq("session_id", id)
    .eq("org_id", auth.orgId);

  return NextResponse.json({ session: data, answers: answers ?? [] });
});

export const DELETE = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", id)
    .eq("org_id", auth.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
