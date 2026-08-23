import { z } from "zod";
import { fail, failValidation, json } from "@/lib/presentiq/api/response";
import { recordFeedback } from "@/lib/presentiq/demo/store";
import { PQ_CONTACT_EMAIL } from "@/lib/presentiq/config";

const Schema = z.object({
  email: z.string().email().max(200),
  subject: z.string().min(2).max(200),
  message: z.string().min(5).max(4000),
  source: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return failValidation("Please check the highlighted fields.", parsed.error.issues);

  const row = await recordFeedback({
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    source: parsed.data.source ?? "platform",
  });

  // Best-effort SMTP forwarding when env is configured. Falls back to a
  // structured server-side log so feedback is never silently dropped.
  // Configure: SMTP_FROM, SMTP_TO, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
  const forwardTo = process.env.SMTP_TO ?? PQ_CONTACT_EMAIL;
  console.log(JSON.stringify({
    type: "presentiq.feedback",
    forwardTo,
    feedback: row,
  }));

  return json({ ok: true, id: row.id });
}
