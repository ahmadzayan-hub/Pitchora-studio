export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";
import { DEMO_PROFILE } from "@/lib/demo";
import { profileUpdateSchema } from "@/lib/profile-input";

function profileResponse(data: { display_name: string | null; avatar_url: string | null; email: string }) {
  return { full_name: data.display_name ?? "", avatar_url: data.avatar_url, email: data.email };
}

export async function GET() {
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json({ ...DEMO_PROFILE, demo: true, persisted: false });
  }
  try {
    const { data, error } = await supabase
      .from("users")
      .select("display_name, avatar_url, email")
      .eq("id", user.id)
      .single();
    if (error || !data) {
      const missing = !error || error.code === "PGRST116";
      return NextResponse.json({ error: missing ? "Profile not found" : "Unable to load profile" }, { status: missing ? 404 : 500 });
    }
    return NextResponse.json(profileResponse(data));
  } catch {
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;
  const parsed = profileUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile", details: parsed.error.flatten() }, { status: 400 });
  const { full_name, avatar_url } = parsed.data;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json({ ...DEMO_PROFILE, ...parsed.data, demo: true, persisted: false });
  }
  const updates = {
    ...(full_name !== undefined ? { display_name: full_name } : {}),
    ...(avatar_url !== undefined ? { avatar_url } : {}),
  };
  try {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select("display_name, avatar_url, email")
      .single();
    if (error || !data) return NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
    return NextResponse.json(profileResponse(data));
  } catch {
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
