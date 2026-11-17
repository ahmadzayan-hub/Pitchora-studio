"use client";

import { useEffect, useState, useCallback } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { loadHistory } from "@/lib/local-history";
import type { TargetModel } from "@/lib/types";

interface TrendItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  tags: string[];
  region?: "me" | "global";
}

interface TrendsResponse {
  trends: TrendItem[];
  date: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  business: "💼",
  coding: "💻",
  writing: "✍️",
  research: "🔍",
  creative: "🎨",
  design: "🖌️",
  planning: "📋",
  analysis: "📊",
  other: "✨",
};

const CATEGORY_COLORS: Record<string, string> = {
  business:  "from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-700",
  coding:    "from-violet-50 to-purple-50 border-violet-200 dark:from-violet-900/20 dark:to-purple-900/20 dark:border-violet-700",
  writing:   "from-sky-50 to-blue-50 border-sky-200 dark:from-sky-900/20 dark:to-blue-900/20 dark:border-sky-700",
  research:  "from-teal-50 to-cyan-50 border-teal-200 dark:from-teal-900/20 dark:to-cyan-900/20 dark:border-teal-700",
  creative:  "from-pink-50 to-rose-50 border-pink-200 dark:from-pink-900/20 dark:to-rose-900/20 dark:border-pink-700",
  design:    "from-fuchsia-50 to-pink-50 border-fuchsia-200 dark:from-fuchsia-900/20 dark:to-pink-900/20 dark:border-fuchsia-700",
  planning:  "from-emerald-50 to-green-50 border-emerald-200 dark:from-emerald-900/20 dark:to-green-900/20 dark:border-emerald-700",
  analysis:  "from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700",
  other:     "from-slate-50 to-gray-50 border-slate-200 dark:from-slate-900/20 dark:to-gray-900/20 dark:border-slate-700",
};

function useTrends(locale: string) {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Derive personalisation from local history — no PII leaves the browser
      const history = loadHistory();
      const intentCounts: Record<string, number> = {};
      for (const entry of history) {
        if (entry.intent) intentCounts[entry.intent] = (intentCounts[entry.intent] ?? 0) + 1;
      }
      const topIntents = Object.entries(intentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k)
        .join(",");

      const params = new URLSearchParams({ locale, limit: "6" });
      if (topIntents) params.set("intents", topIntents);

      const res = await fetch(`/api/trends?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data: TrendsResponse = await res.json();
      setTrends(data.trends ?? []);
      setDate(data.date ?? "");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  return { trends, date, loading, error, refetch: fetchTrends };
}

interface PromptTrendsProps {
  locale?: string;
}

export default function PromptTrends({ locale = "en" }: PromptTrendsProps) {
  const t = useT();
  const { trends, date, loading, error, refetch } = useTrends(locale);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleTryPrompt(trend: TrendItem) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "po_starter",
        JSON.stringify({ text: trend.prompt, model: "chatgpt" as TargetModel })
      );
      // Intentional full navigation: the starter text is handed over via sessionStorage.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/workspace";
    }
  }

  async function handleCopy(trend: TrendItem) {
    try {
      await navigator.clipboard.writeText(trend.prompt);
      setCopied(trend.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <SectionHeader date="" loading />
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-36 bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
          <div className="text-3xl mb-3" aria-hidden="true">📡</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {locale === "ar" ? "تعذّر تحميل الاتجاهات" : "Could not load trends"}
          </p>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {locale === "ar" ? "↺ أعد المحاولة" : "↺ Retry"}
          </button>
        </div>
      </section>
    );
  }

  if (trends.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
      <SectionHeader date={date} />

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {trends.map((trend) => {
          const isExpanded = expanded === trend.id;
          const colorClass = CATEGORY_COLORS[trend.category] ?? CATEGORY_COLORS.other;
          const icon = CATEGORY_ICONS[trend.category] ?? "✨";

          return (
            <div
              key={trend.id}
              className={`relative rounded-xl border bg-gradient-to-br p-4 transition-all duration-200 hover:shadow-md ${colorClass}`}
            >
              {/* Region badge */}
              {trend.region === "me" && (
                <span className="absolute top-3 end-3 text-sm" title="Middle East / Arabic focus" aria-label="Middle East focus">
                  🇦🇪
                </span>
              )}

              {/* Header */}
              <div className="flex items-start gap-2 pe-6">
                <span className="text-xl leading-none mt-0.5" aria-hidden="true">{icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t(`intent.${trend.category}` as Parameters<typeof t>[0]) ?? trend.category}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {trend.title}
                  </h3>
                </div>
              </div>

              {/* Prompt preview / expanded */}
              <p
                className={`mt-2 text-xs text-slate-700 dark:text-slate-200 leading-relaxed transition-all ${isExpanded ? "" : "line-clamp-2"}`}
              >
                {trend.prompt}
              </p>

              {/* Tags */}
              {trend.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {trend.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-block rounded-full bg-white/60 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleTryPrompt(trend)}
                  className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {t("home.examples.try")} →
                </button>
                <button
                  onClick={() => handleCopy(trend)}
                  title={t("ws.btn.copy")}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium px-2.5 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {copied === trend.id ? "✓" : t("ws.btn.copy")}
                </button>
                <button
                  onClick={() => setExpanded(isExpanded ? null : trend.id)}
                  title={isExpanded ? t("trends.collapse") : t("trends.expand")}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs px-2 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 text-center">
        {t("trends.refresh_hint")}
      </p>
    </section>
  );
}

function SectionHeader({ date, loading }: { date: string; loading?: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {t("trends.section_title")}
        </h2>
        {date && !loading && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {t("trends.updated_for")} {date}
          </p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {t("trends.live_badge")}
      </span>
    </div>
  );
}
