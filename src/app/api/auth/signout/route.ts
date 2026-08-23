export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/db/supabase-server";

export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tweenz.ae";
  if (!isDemoMode) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", appUrl));
}
