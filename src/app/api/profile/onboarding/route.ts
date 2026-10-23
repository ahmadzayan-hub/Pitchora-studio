export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { onboardingSchema } from "@/lib/profile-input";

export async function POST(req: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  const parsed = onboardingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding data", details: parsed.error.flatten() }, { status: 400 });
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json({ ok: true, demo: true, persisted: false });
  }
  const input = parsed.data;
  try {
    // One invoker-rights transaction, bound to auth.uid() inside the database.
    const { error } = await supabase.rpc("complete_tweenz_onboarding", {
      p_full_name: input.full_name,
      p_program_name: input.program_name,
      p_university: input.university,
      p_gpa_scale: input.gpa_scale,
      p_study_hours: input.study_hours_per_week,
      p_primary_language: input.primary_language,
      p_goal: input.goal,
    });
    if (error) return NextResponse.json({ error: "Unable to save onboarding. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save onboarding. Please try again." }, { status: 500 });
  }
}
