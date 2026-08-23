export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, DEMO_COURSES, DEMO_DEADLINES, DEMO_GRADES, DEMO_STUDY_PACKS, DEMO_FILES } from "@/lib/demo";
import { getUser, createClient } from "@/lib/db/supabase-server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  if (isDemoMode) {
    const results: any[] = [];
    DEMO_COURSES.filter((c: any) => c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q))
      .slice(0,3).forEach((c: any) => results.push({ type: "course",   label: c.name,      subtitle: c.code,           href: `/courses/${c.id}` }));
    DEMO_DEADLINES.filter((d: any) => d.title?.toLowerCase().includes(q))
      .slice(0,3).forEach((d: any) => results.push({ type: "deadline", label: d.title,     subtitle: d.course_name,    href: "/timeline" }));
    DEMO_GRADES.filter((g: any) => g.item_name?.toLowerCase().includes(q))
      .slice(0,2).forEach((g: any) => results.push({ type: "grade",    label: g.item_name, subtitle: g.category,       href: "/grades" }));
    DEMO_STUDY_PACKS.filter((p: any) => p.topic?.toLowerCase().includes(q))
      .slice(0,2).forEach((p: any) => results.push({ type: "pack",     label: p.topic,     subtitle: "Study Pack",     href: "/study-packs" }));
    DEMO_FILES.filter((f: any) => f.file_name?.toLowerCase().includes(q))
      .slice(0,2).forEach((f: any) => results.push({ type: "file",     label: f.file_name, subtitle: f.processing_status, href: "/files" }));
    return NextResponse.json(results.slice(0, 10));
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const [cRes, dRes, gRes, pRes, fRes] = await Promise.all([
    supabase.from("courses").select("id,name,code").eq("user_id", user.id).ilike("name", `%${q}%`).limit(3),
    supabase.from("deadlines").select("id,title,course_name:courses(name)").eq("user_id", user.id).ilike("title", `%${q}%`).limit(3),
    supabase.from("grades").select("id,item_name,category").eq("user_id", user.id).ilike("item_name", `%${q}%`).limit(2),
    supabase.from("study_packs").select("id,topic").eq("user_id", user.id).ilike("topic", `%${q}%`).limit(2),
    supabase.from("private_files").select("id,file_name").eq("user_id", user.id).ilike("file_name", `%${q}%`).limit(2),
  ]);

  const results: any[] = [];
  (cRes.data ?? []).forEach((c: any) => results.push({ type: "course",   label: c.name,      subtitle: c.code,        href: `/courses/${c.id}` }));
  (dRes.data ?? []).forEach((d: any) => results.push({ type: "deadline", label: d.title,     subtitle: d.course_name, href: "/timeline" }));
  (gRes.data ?? []).forEach((g: any) => results.push({ type: "grade",    label: g.item_name, subtitle: g.category,    href: "/grades" }));
  (pRes.data ?? []).forEach((p: any) => results.push({ type: "pack",     label: p.topic,     subtitle: "Study Pack",  href: "/study-packs" }));
  (fRes.data ?? []).forEach((f: any) => results.push({ type: "file",     label: f.file_name, subtitle: "File",        href: "/files" }));
  return NextResponse.json(results);
}
