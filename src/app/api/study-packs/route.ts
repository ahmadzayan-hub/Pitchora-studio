import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { aiChat } from "@/lib/ai/client";
import { demoReturn } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("study-packs"); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("study_packs").select("*, courses(name), private_files(name)").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { file_id, course_id, title } = await req.json();
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json({ id: `pack-${Date.now()}`, user_id: "demo-user", file_id, course_id, title: title || "New Study Pack", status: "generating", generating: true, created_at: new Date().toISOString() }, { status: 201 });
  }
  const supabase = await createClient();

  // Check AI quota
  const { data: sub } = await supabase.from("subscriptions").select("ai_queries_used, ai_queries_limit").eq("user_id", user.id).single();
  if (sub && sub.ai_queries_used >= sub.ai_queries_limit) {
    return NextResponse.json({ error: "Monthly AI query limit reached. Upgrade your plan." }, { status: 429 });
  }

  // Get transcript
  const { data: transcript } = await supabase.from("transcripts").select("text").eq("file_id", file_id).single();
  const content = transcript?.text ?? "";

  // Create study pack record
  const { data: pack, error: packError } = await supabase.from("study_packs")
    .insert({ user_id: user.id, file_id, course_id: course_id || null, title: title || "Study Pack", status: "generating" })
    .select().single();
  if (packError) return NextResponse.json({ error: packError.message }, { status: 500 });

  // Generate AI content (non-blocking - return immediately, update in background)
  generateStudyPack(pack.id, content, user.id, supabase).catch(console.error);

  return NextResponse.json({ ...pack, generating: true }, { status: 201 });
}

async function generateStudyPack(packId: string, content: string, userId: string, supabase: any) {
  try {
    const prompt = `You are an expert MBA study assistant. Analyze this lecture content and create a comprehensive study pack. Respond with JSON:
{
  "overview": "2-3 sentence lecture overview",
  "summary": "Executive summary (150-200 words)",
  "detailed_notes": "Full structured notes with headings",
  "key_takeaways": ["takeaway 1", "takeaway 2", ...],
  "glossary": [{"term": "...", "definition": "..."}],
  "mba_frameworks": [{"name": "SWOT/Porter/etc", "application": "how it applies here"}],
  "prof_emphasis": ["point 1", "point 2"],
  "exam_prep_notes": "What to study for exam"
}

Lecture content:
${content.slice(0, 8000)}`;

    const response = await aiChat([
      { role: "system", content: "You are an expert MBA academic tutor and study pack generator. Always respond with valid JSON only." },
      { role: "user", content: prompt },
    ], { maxTokens: 4000 });

    const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const { error: updateError } = await supabase.from("study_packs").update({
      status: "ready",
      overview: parsed.overview,
      summary: parsed.summary,
      detailed_notes: parsed.detailed_notes,
      key_takeaways: parsed.key_takeaways,
      glossary: parsed.glossary,
      mba_frameworks: parsed.mba_frameworks,
      prof_emphasis: parsed.prof_emphasis,
      exam_prep_notes: parsed.exam_prep_notes,
      updated_at: new Date().toISOString(),
    }).eq("id", packId);
    if (updateError) throw new Error(updateError.message);

    // Generate flashcards
    const fcPrompt = `Based on the lecture below, generate 10 flashcards. Respond with JSON array: [{"front": "Question or term", "back": "Answer or definition"}]\n\nContent:\n${content.slice(0, 4000)}`;
    const fcResponse = await aiChat([
      { role: "system", content: "Generate concise flashcards as JSON only." },
      { role: "user", content: fcPrompt },
    ], { maxTokens: 1500 });
    const fcCleaned = fcResponse.replace(/```json\n?|\n?```/g, "").trim();
    let flashcards: unknown;
    try { flashcards = JSON.parse(fcCleaned); } catch { flashcards = []; }
    if (Array.isArray(flashcards)) {
      const fcRows = flashcards.map((f: any) => ({ user_id: userId, study_pack_id: packId, front: f.front, back: f.back }));
      await supabase.from("flashcards").insert(fcRows);
    }

    // Log AI usage
    await supabase.from("ai_usage_logs").insert({ user_id: userId, operation: "study_pack", model: process.env.AI_MODEL ?? "claude-sonnet-4-6", input_tokens: Math.ceil(content.length / 4), output_tokens: 1000, success: true });
    await supabase.rpc("increment_ai_queries", { uid: userId }).catch(() => null);

  } catch (err) {
    await supabase.from("study_packs").update({ status: "failed" }).eq("id", packId);
  }
}
