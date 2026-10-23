export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { withDeadlineRisk } from "@/lib/deadline-risk";

export async function GET() {
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const now = Date.now();
  const [courses, grades, deadlines, announcements, files] = await Promise.all([
    supabase.from("courses").select("*").eq("user_id", user.id),
    supabase.from("grades").select("*").eq("user_id", user.id),
    supabase.from("deadlines").select("*").eq("user_id", user.id),
    supabase.from("announcements").select("*").eq("user_id", user.id),
    supabase.from("private_files").select("file_name, file_size, created_at").eq("user_id", user.id),
  ]);

  const exportData = {
    exported_at: new Date(now).toISOString(),
    user_id: user.id,
    courses: courses.data || [],
    grades: grades.data || [],
    deadlines: deadlines.data?.map((deadline: any) => withDeadlineRisk(deadline, now)) || [],
    announcements: announcements.data || [],
    files: files.data || [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="tweenz-data-${now}.json"`,
    },
  });
}
