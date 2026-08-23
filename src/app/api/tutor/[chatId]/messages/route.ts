import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { aiChat } from "@/lib/ai/client";
import { retrieveChunks, buildContext, extractCitations } from "@/lib/rag/retriever";

export async function GET(req: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json([]);
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("tutor_messages").select("*").eq("chat_id", params.chatId).eq("user_id", user.id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  const { content, course_id } = await req.json();
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const reply = `Great question! Based on your uploaded course materials, here's what I found:\n\n**Key insight**: ${content.length > 30 ? "Your question relates to a core MBA concept covered in your study packs." : "This concept is foundational to your MBA program."}\n\nFor a deeper dive, I recommend opening the relevant Study Pack — your Porter's Five Forces and DCF Valuation packs have comprehensive coverage of related frameworks.\n\n*Note: This is a demo response. Connect a real AI provider in settings to get live, context-aware tutoring from your actual uploaded files.*`;
    return NextResponse.json({ id: `msg-${Date.now()}`, chat_id: params.chatId, role: "assistant", content: reply, citations: [], is_grounded: false, created_at: new Date().toISOString() });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  // Save user message
  await supabase.from("tutor_messages").insert({ chat_id: params.chatId, user_id: user.id, role: "user", content });

  // Get recent chat history
  const { data: history } = await supabase.from("tutor_messages").select("role, content").eq("chat_id", params.chatId).order("created_at").limit(10);

  // Retrieve context via RAG
  let contextText = "";
  let citations: any[] = [];
  let isGrounded = false;

  try {
    const chunks = await retrieveChunks(content, user.id, course_id, 8);
    if (chunks.length > 0) {
      const { data: files } = await supabase.from("private_files").select("id, name").eq("user_id", user.id);
      const fileNames = new Map<string, string>((files ?? []).map((f: any) => [f.id, f.name]));
      contextText = buildContext(chunks, fileNames);
      citations = extractCitations(chunks, fileNames);
      isGrounded = true;
    }
  } catch {}

  const systemPrompt = `You are an expert AI tutor for MBA students. You answer questions based on the student's uploaded course materials.

${contextText ? `Your knowledge base for this conversation:\n\n${contextText}\n\n---\n` : ""}

Rules:
- Answer only from the provided course materials when available
- If information is not in the materials, clearly say: "This is not in your uploaded material. I can explain the general concept."
- Always cite your sources with [Source N] references
- Keep answers focused, clear, and MBA-relevant
- Help the student understand, not just memorize`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? []).map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content },
  ];

  let aiContent = "";
  try {
    aiContent = await aiChat(messages, { maxTokens: 1200, temperature: 0.2 });
  } catch {
    aiContent = "I'm having trouble generating a response. Please try again.";
  }

  // Save AI response
  const { data: aiMsg, error } = await supabase.from("tutor_messages").insert({
    chat_id: params.chatId, user_id: user.id, role: "assistant",
    content: aiContent, citations, is_grounded: isGrounded,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update chat title if first exchange
  if ((history?.length ?? 0) === 0) {
    await supabase.from("tutor_chats").update({ title: content.slice(0, 60), updated_at: new Date().toISOString() }).eq("id", params.chatId);
  }

  // Log usage
  await supabase.from("ai_usage_logs").insert({ user_id: user.id, operation: "tutor_chat", model: process.env.AI_MODEL ?? "claude-sonnet-4-6", input_tokens: 500, output_tokens: 300, success: true });

  return NextResponse.json(aiMsg);
}
