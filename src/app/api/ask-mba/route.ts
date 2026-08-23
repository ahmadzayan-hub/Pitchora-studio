import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { aiChat } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { query } = await req.json();
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const answers: Record<string, string> = {
      default: `**Based on your academic profile, here's my assessment:**\n\nYou currently have 2 at-risk deadlines requiring immediate attention:\n\n1. **Porter's Five Forces Case Study** (due in 2 days) — Strategic Management\n2. **Marketing Campaign Proposal** (due in 3 days) — Digital Marketing\n\nYour strongest course is Digital Marketing (90% progress) and you should leverage that momentum. For Financial Analysis (65%), the mid-term format change to 2 case studies means you should prioritize DCF practice.\n\n**Recommended action:** Block 4 hours today for the Tesla case study using your Porter's Five Forces Study Pack.`,
    };
    const q = query?.toLowerCase() ?? "";
    let answer = answers.default;
    if (q.includes("deadline") || q.includes("due")) {
      answer = `**Your Upcoming Deadlines:**\n\n🔴 **Overdue**: SWOT Analysis Report (Strategic Management) — submit ASAP for partial credit\n🟠 **At Risk (2 days)**: Porter's Five Forces Case Study — Tesla in GCC\n🟠 **At Risk (3 days)**: Marketing Campaign Proposal — Noon.com strategy\n🟡 **Due Soon (5 days)**: Financial Modeling Assignment — DCF model\n🟡 **Due Soon (7 days)**: HRM Leadership Essay\n\n**My recommendation**: Focus today entirely on the Porter's Case Study. Use Study Pack 1 and Flashcard Deck to review the framework efficiently.`;
    } else if (q.includes("grade") || q.includes("gpa") || q.includes("score")) {
      answer = `**Your Grade Summary:**\n\nYour strongest performance: **Operations Lab Report (91%)** — excellent work.\n\nRecent grades:\n- Operations: 91/100 (Lab Report) ✅\n- Digital Marketing: 88/100 (Campaign Concept) ✅  \n- Strategic Management: 82/100 (Industry Analysis) ✅\n- Leadership & OB: 76/100 (Case Discussion) ⚠️\n- Financial Analysis: 74/100 (Quiz) ⚠️\n\n**Risk areas**: Financial Analysis and Leadership & Org Behavior are below your average. With the FIN 502 mid-term approaching, I'd prioritize those two courses this week.`;
    } else if (q.includes("study") || q.includes("plan") || q.includes("prepare")) {
      answer = `**Personalized Study Plan for This Week:**\n\n**Today (Wed, May 6):**\n• 9:00–13:00: Porter's Five Forces Case Study (use Study Pack 1)\n• 14:00–16:00: Begin Marketing Campaign Proposal outline\n\n**Thursday:**\n• Morning: Finalize + submit Porter's Case Study\n• Afternoon: Marketing Proposal draft\n\n**Friday:**\n• Marketing Proposal final review + submit\n• Start Financial Modeling Assignment (DCF structure)\n\n**Weekend:**\n• Saturday: Complete DCF model\n• Sunday: HRM Leadership Essay outline + FIN 502 review (chapters 1–4)\n\nYour Digital Marketing Study Pack is ready — use it for the campaign proposal tonight.`;
    }
    return NextResponse.json({ answer });
  }
  const supabase = await createClient();

  // Gather academic context
  const [courses, deadlines, announcements, grades] = await Promise.all([
    supabase.from("courses").select("name, code, progress, status").eq("user_id", user.id).limit(10),
    supabase.from("deadlines").select("title, due_date, risk, type, courses(name)").eq("user_id", user.id).eq("is_done", false).order("due_date").limit(10),
    supabase.from("announcements").select("title, summary, risk_level, courses(name)").eq("user_id", user.id).eq("is_archived", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("grades").select("category, item_name, score, max_score, weight, courses(name)").eq("user_id", user.id).limit(20),
  ]);

  const context = `
STUDENT ACADEMIC DATA:

COURSES:
${courses.data?.map((c: any) => `- ${c.name} (${c.code}) — Progress: ${c.progress}% — Status: ${c.status}`).join("\n") ?? "No courses"}

UPCOMING DEADLINES:
${deadlines.data?.map((d: any) => `- ${d.title} | ${(d.courses as any)?.name} | Due: ${d.due_date} | Risk: ${d.risk}`).join("\n") ?? "No deadlines"}

RECENT ANNOUNCEMENTS:
${announcements.data?.map((a: any) => `- ${a.title} | ${(a.courses as any)?.name} | Risk: ${a.risk_level} | ${a.summary}`).join("\n") ?? "No announcements"}

GRADES:
${grades.data?.map((g: any) => `- ${(g.courses as any)?.name} | ${g.category}: ${g.item_name} | ${g.score !== null ? `${g.score}/${g.max_score}` : "Pending"} | Weight: ${g.weight}%`).join("\n") ?? "No grades"}
`;

  const response = await aiChat([
    { role: "system", content: `You are "Ask My MBA" — a smart academic advisor agent for an MBA student. You have access to the student's full academic data. Answer their questions directly and helpfully. Be concise but thorough. Always refer to specific courses, deadlines, or grades from the data when relevant. Format your response clearly with sections if needed.` },
    { role: "user", content: `${context}\n\nStudent question: ${query}` },
  ], { maxTokens: 1500, temperature: 0.3 });

  await supabase.from("ai_usage_logs").insert({ user_id: user.id, operation: "ask_mba", model: process.env.AI_MODEL ?? "claude-sonnet-4-6", input_tokens: 800, output_tokens: 400, success: true });

  return NextResponse.json({ answer: response });
}
