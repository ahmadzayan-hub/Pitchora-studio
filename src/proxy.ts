import type { NextRequest } from "next/server";
import { updateSession } from "../utils/supabase/middleware";

/**
 * Runs on every request to keep the Supabase session fresh — refreshes the
 * auth cookie before it expires so server components and API routes see a
 * valid user.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths EXCEPT static assets, the SW, and known public files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|demo.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
