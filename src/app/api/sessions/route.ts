import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserOrg } from "@/lib/services/auth";
import { detectIntent } from "@/lib/services/orchestration";
import { findGaps, generateQuestions } from "@/lib/services/clarification";
import { reconstructPrompt, postFormatForModel } from "@/lib/services/formatter";
import { handleError, safeRoute } from "@/lib/api-helpers";
import type { TargetModel } from "@/lib/types";

const Body = z.object({
  raw_prompt: z.string().min(3).max(8000),
  target_model: z.enum(["chatgpt", "claude", "copilot", "gemini", "generic"]).optional(),
  template_id: z.string().uuid().optional(),
  // when true: skip clarifications and finalize in one call
  quick: z.boolean().optional()
});

export const POST = safeRoute(async (req: NextRequest) => {
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { raw_prompt, target_model = "generic", template_id, quick = false } = parsed.data;
  const supabase = await getServerSupabase();

  try {
    const intent = await detectIntent(raw_prompt);

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        org_id: auth.orgId,
        user_id: auth.userId,
        raw_prompt,
        intent: intent.intent,
        intent_confidence: intent.confidence,
        target_model,
        template_id: template_id ?? null,
        status: "intake"
      })
      .select("*")
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "create_failed", detail: error?.message }, { status: 500 });
    }

    if (quick) {
      // Skip clarifications: build directly from raw prompt
      const result = await reconstructPrompt(
        { rawPrompt: raw_prompt, intent: intent.intent, qa: [] },
        target_model as TargetModel
      );
      const finalPrompt = postFormatForModel(result.final_prompt, target_model as TargetModel);

      await supabase.from("prompt_versions").insert({
        session_id: session.id,
        org_id: auth.orgId,
        version: 1,
        target_model,
        final_prompt: finalPrompt,
        rationale: result.rationale
      });

      await supabase.from("sessions").update({ status: "finalized" }).eq("id", session.id);

      const { data: full } = await supabase
        .from("sessions")
        .select("*, questions(*), prompt_versions(*)")
        .eq("id", session.id)
        .single();
      return NextResponse.json({ session: full, mode: "quick" });
    }

    // Normal flow: gap analysis + questions
    const gaps = await findGaps(raw_prompt, intent.intent);
    const questions = await generateQuestions(raw_prompt, intent.intent, gaps);

    if (questions.length > 0) {
      await supabase.from("questions").insert(
        questions.map((q, i) => ({
          session_id: session.id,
          org_id: auth.orgId,
          position: i,
          question: q.question,
          rationale: q.rationale,
          required: q.required
        }))
      );
      await supabase.from("sessions").update({ status: "clarifying" }).eq("id", session.id);
    } else {
      await supabase.from("sessions").update({ status: "ready" }).eq("id", session.id);
    }

    const { data: fullSession } = await supabase
      .from("sessions")
      .select("*, questions(*)")
      .eq("id", session.id)
      .single();

    return NextResponse.json({ session: fullSession, mode: "clarify" });
  } catch (e) {
    return handleError(e);
  }
});

export const GET = safeRoute(async (req: NextRequest) => {
  const auth = await requireUserOrg(req.headers.get("x-org-id"));
  if (auth instanceof NextResponse) return auth;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, raw_prompt, intent, status, target_model, created_at, updated_at")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
});
