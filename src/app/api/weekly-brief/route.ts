export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { aiChat } from "@/lib/ai/client";
import { demoReturn } from "@/lib/demo";

export async function GET() {
  const demo = demoReturn("weekly-brief"); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("weekly_briefs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single();
  return NextResponse.json(data);
}

export async function POST() {
  const demo = demoReturn("weekly-brief", 201); if (demo) return demo;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const [courses, deadlines, announcements, grades, tasks] = await Promise.all([
    supabase.from("courses").select("name, progress, status").eq("user_id", user.id),
    supabase.from("deadlines").select("title, due_date, risk, type, courses(name)").eq("user_id", user.id).eq("is_done", false).lte("due_date", new Date(Date.now() + 14 * 86400000).toISOString()),
    supabase.from("announcements").select("title, summary, risk_level").eq("user_id", user.id).eq("is_archived", false).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("grades").select("item_name, score, max_score, courses(name)").eq("user_id", user.id),
    supabase.from("tasks").select("title, status, priority").eq("user_id", user.id).neq("status", "completed"),
  ]);

  const context = `
Courses: ${JSON.stringify(courses.data)}
Deadlines: ${JSON.stringify(deadlines.data)}
Announcements: ${JSON.stringify(announcements.data)}
Grades: ${JSON.stringify(grades.data)}
Tasks: ${JSON.stringify(tasks.data)}
`;

  const prompt = `You are an academic advisor generating a weekly MBA brief. Based on the student's data, write a structured weekly brief in JSON:
{
  "summary": "2-3 sentence executive summary of the week",
  "courses_status": "Brief status of courses",
  "urgent_items": ["item 1", "item 2"],
  "upcoming_deadlines": ["deadline summary 1"],
  "grade_risks": ["risk 1"],
  "recommended_study_plan": "Day-by-day study plan for the week",
  "weekend_plan": "Weekend study recommendations",
  "instructor_questions": ["Question to ask Professor X about Y"]
}

Student data: ${context}`;

  const response = await aiChat([
    { role: "system", content: "You are an expert academic advisor generating structured weekly briefs. Respond with valid JSON only." },
    { role: "user", content: prompt },
  ], { maxTokens: 2000 });

  let content: any = {};
  try { content = JSON.parse(response.replace(/```json\n?|\n?```/g, "").trim()); } catch {}

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

  const { data: brief, error } = await supabase.from("weekly_briefs").insert({
    user_id: user.id,
    week_start: weekStart.toISOString().split("T")[0],
    week_end: weekEnd.toISOString().split("T")[0],
    content,
    summary: content.summary,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(brief, { status: 201 });
}
