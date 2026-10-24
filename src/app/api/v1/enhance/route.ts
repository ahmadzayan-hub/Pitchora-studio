import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { detectIntent } from "@/lib/services/orchestration";
import { findGaps, generateQuestions } from "@/lib/services/clarification";
import { reconstructPrompt, postFormatForModel } from "@/lib/services/formatter";
import { requireApiKey } from "@/lib/services/auth";
import { handleError } from "@/lib/api-helpers";
import type { TargetModel } from "@/lib/types";

/**
 * Public, versioned enhance endpoint.
 *
 *   POST /api/v1/enhance
 *   Authorization: Bearer <EXTENSION_API_KEY>
 *
 * Body (zod-validated):
 *   { raw_prompt, target_model?, qa?, ask_first? }
 *
 * Same logic as /api/extension/enhance — this `/v1/` URL is the stable
 * contract for third-party integrations. The extension keeps its existing
 * URL for backward compatibility; new integrations should target /v1/.
 */

const Body = z.object({
  raw_prompt: z.string().min(3).max(8000),
  target_model: z.enum(["chatgpt", "claude", "copilot", "gemini", "generic"]).optional(),
  qa: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(100)
    .optional(),
  ask_first: z.boolean().optional()
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKey(req.headers.get("authorization"));
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { raw_prompt, target_model = "generic", qa = [], ask_first = false } = parsed.data;

    const intent = await detectIntent(raw_prompt);

    if (ask_first) {
      const gaps = await findGaps(raw_prompt, intent.intent);
      const questions = await generateQuestions(raw_prompt, intent.intent, gaps);
      return NextResponse.json({ api_version: "v1", intent, questions });
    }

    const result = await reconstructPrompt(
      { rawPrompt: raw_prompt, intent: intent.intent, qa },
      target_model as TargetModel
    );
    const final_prompt = postFormatForModel(result.final_prompt, target_model as TargetModel);

    return NextResponse.json({
      api_version: "v1",
      intent,
      target_model,
      final_prompt,
      rationale: result.rationale
    });
  } catch (e) {
    return handleError(e);
  }
}
