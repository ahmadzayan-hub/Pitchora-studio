export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { isDemoMode } from "@/lib/demo";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // In demo mode, Google OAuth is simulated — go straight to dashboard
  if (isDemoMode) {
    return NextResponse.redirect(`${appUrl}/dashboard`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl}/api/auth/callback` },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
