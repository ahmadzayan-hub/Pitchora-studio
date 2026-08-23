import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { reconstructPrompt, postFormatForModel } from "@/lib/services/formatter";
import { handleError, safeRoute } from "@/lib/api-helpers";
import type { Template, TargetModel } from "@/lib/types";

const Body = z.object({
  target_model: z.enum(["chatgpt", "claude", "copilot", "gemini", "generic"]).optional()
});

export const POST = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Next 15: route params arrive as a promise.
  const { id } = await params;
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const supabase = await getServerSupabase();

  try {
    const { data: session, error } = await supabase
      .from("sessions")
      .select("*, questions(*), template:template_id(*)")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .maybeSingle();
    if (error || !session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { data: answers } = await supabase
      .from("answers")
      .select("question_id, answer")
      .eq("session_id", id)
      .eq("org_id", auth.orgId);

    const qa: Array<{ question: string; answer: string }> = [];
    for (const q of session.questions ?? []) {
      const a = answers?.find((x) => x.question_id === q.id);
      if (a) qa.push({ question: q.question, answer: a.answer });
    }

    const targetModel: TargetModel = (parsed.data?.target_model ??
      session.target_model ??
      "generic") as TargetModel;

    const reconstructed = await reconstructPrompt(
      {
        rawPrompt: session.raw_prompt,
        intent: session.intent ?? "other",
        qa,
        template: (session.template as Template | null) ?? null
      },
      targetModel
    );

    const finalPrompt = postFormatForModel(reconstructed.final_prompt, targetModel);

    const { data: existing } = await supabase
      .from("prompt_versions")
      .select("version")
      .eq("session_id", id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    const { data: version, error: insErr } = await supabase
      .from("prompt_versions")
      .insert({
        session_id: id,
        org_id: auth.orgId,
        version: nextVersion,
        target_model: targetModel,
        final_prompt: finalPrompt,
        rationale: reconstructed.rationale
      })
      .select("*")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await supabase
      .from("sessions")
      .update({ status: "finalized", target_model: targetModel })
      .eq("id", id);

    return NextResponse.json({ version });
  } catch (e) {
    return handleError(e);
  }
});
