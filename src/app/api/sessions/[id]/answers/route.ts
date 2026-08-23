import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { safeRoute } from "@/lib/api-helpers";

const Body = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        answer: z.string().min(1).max(4000)
      })
    )
    .min(1)
});

export const POST = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await getServerSupabase();

  // Verify session belongs to org
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = parsed.data.answers.map((a) => ({
    question_id: a.question_id,
    session_id: id,
    org_id: auth.orgId,
    answer: a.answer
  }));

  const { error } = await supabase.from("answers").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // mark session ready
  await supabase.from("sessions").update({ status: "ready" }).eq("id", id);

  return NextResponse.json({ ok: true, count: rows.length });
});
