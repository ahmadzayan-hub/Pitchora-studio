export const dynamic = "force-dynamic";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeRoute } from "@/lib/api-helpers";

interface FeedbackRow {
  rating: number;
  intent: string | null;
  target_model: string | null;
  locale: string | null;
  comment: string | null;
  created_at: string;
}

/**
 * Aggregated feedback dashboard endpoint.
 *
 * RLS already restricts SELECT on `feedback` to org owners/admins, so we
 * just authenticate the user and run the query — Postgres enforces the
 * permission boundary. Anonymous-org rows (org_id = null) are returned to
 * any authenticated user; that's intentional, since they have no owning
 * org and the platform admins want to see them.
 *
 * The endpoint returns up to 1000 rows + summary aggregates the UI uses to
 * render charts. Pagination can be added later if volume warrants it.
 */
export const GET = safeRoute(async (_req: NextRequest) => {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("feedback")
    .select("rating, intent, target_model, locale, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as FeedbackRow[];

  // Aggregate
  let positive = 0, negative = 0, neutral = 0;
  const byIntent: Record<string, { up: number; down: number }> = {};
  const byModel:  Record<string, { up: number; down: number }> = {};
  const byLocale: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  for (const r of rows) {
    if (r.rating > 0) positive++;
    else if (r.rating < 0) negative++;
    else neutral++;

    const intent = r.intent ?? "other";
    byIntent[intent] = byIntent[intent] ?? { up: 0, down: 0 };
    if (r.rating > 0) byIntent[intent].up++;
    if (r.rating < 0) byIntent[intent].down++;

    const model = r.target_model ?? "generic";
    byModel[model] = byModel[model] ?? { up: 0, down: 0 };
    if (r.rating > 0) byModel[model].up++;
    if (r.rating < 0) byModel[model].down++;

    const loc = r.locale ?? "unknown";
    byLocale[loc] = (byLocale[loc] ?? 0) + 1;

    if (r.comment && r.comment.startsWith("tags:")) {
      const tags = r.comment.replace(/^tags:\s*/, "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const tag of tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const total = rows.length;
  return NextResponse.json({
    total,
    positive,
    negative,
    neutral,
    pct_positive: total ? Math.round((positive / total) * 100) : 0,
    by_intent: byIntent,
    by_model: byModel,
    by_locale: byLocale,
    top_tags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count })),
    recent: rows.slice(0, 20)
  });
});
