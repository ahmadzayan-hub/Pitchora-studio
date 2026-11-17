"use client";

import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadHistory, toggleBookmark, removeHistoryEntry, clearUnstarred } from "@/lib/local-history";
import type { LocalHistoryEntry } from "@/lib/local-history";

const CATEGORIES_EN = [
  "All", "Coding", "Writing", "Research", "Analysis", "Planning",
  "Creative", "Design", "Business", "Academic", "Other"
];
const CATEGORIES_AR = [
  "الكل", "برمجة", "كتابة", "بحث", "تحليل", "تخطيط",
  "إبداع", "تصميم", "أعمال", "أكاديمي", "أخرى"
];

const INTENT_TO_CAT_EN: Record<string, string> = {
  coding: "Coding", writing: "Writing", research: "Research", analysis: "Analysis",
  planning: "Planning", creative: "Creative", design: "Design", report: "Business",
  software: "Coding", website: "Design", other: "Other",
};
const INTENT_TO_CAT_AR: Record<string, string> = {
  coding: "برمجة", writing: "كتابة", research: "بحث", analysis: "تحليل",
  planning: "تخطيط", creative: "إبداع", design: "تصميم", report: "أعمال",
  software: "برمجة", website: "تصميم", other: "أخرى",
};

export default function LibraryPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [entries, setEntries] = useState<LocalHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [tab, setTab] = useState<"all" | "starred">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  const cats = ar ? CATEGORIES_AR : CATEGORIES_EN;

  const filtered = useMemo(() => {
    let list = entries;
    if (tab === "starred") list = list.filter((e) => e.bookmarked);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.raw.toLowerCase().includes(q) ||
        (e.final_prompt ?? "").toLowerCase().includes(q) ||
        (e.intent ?? "").includes(q)
      );
    }
    if (cat !== "All" && cat !== "الكل") {
      const map = ar ? INTENT_TO_CAT_AR : INTENT_TO_CAT_EN;
      const intentKey = Object.entries(map).find(([, v]) => v === cat)?.[0];
      if (intentKey) list = list.filter((e) => e.intent === intentKey);
    }
    return list;
  }, [entries, search, cat, tab]);

  function star(id: string) {
    toggleBookmark(id);
    setEntries(loadHistory());
  }

  function remove(id: string) {
    removeHistoryEntry(id);
    setEntries(loadHistory());
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  function tryInWorkspace(raw: string) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("po_starter", JSON.stringify({ text: raw, model: "chatgpt" }));
      // Intentional full navigation: the starter text is handed over via sessionStorage.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/workspace";
    }
  }

  return (
    <main className="min-h-screen bg-brand-mesh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl" aria-hidden="true">📚</span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {ar ? "مكتبة الموجّهات" : "Prompt Library"}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {ar
              ? "موجّهاتك المحفوظة مرتّبة حسب النوع — ابحث، نجّم، أو جرّب مباشرةً في مساحة العمل"
              : "Your saved prompts organised by category — search, star, or try directly in the workspace"}
          </p>
          <div className="mt-2 text-xs text-slate-400">
            {ar ? `${entries.length} موجِّه في التاريخ` : `${entries.length} prompts in history`}
          </div>
        </div>

        {/* Search + filters */}
        <div className="card mb-6 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? "ابحث في موجّهاتك…" : "Search your prompts…"}
            className="flex-1"
          />
          <div className="flex gap-2">
            {(["all", "starred"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                  tab === t
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                ].join(" ")}
              >
                {t === "all" ? (ar ? "الكل" : "All") : (ar ? "⭐ المنجّمة" : "⭐ Starred")}
              </button>
            ))}
            <button
              onClick={() => { clearUnstarred(); setEntries(loadHistory()); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-all"
            >
              {ar ? "مسح غير المنجّمة" : "Clear unstarred"}
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {cats.map((c, i) => (
            <button
              key={c}
              onClick={() => setCat(ar ? c : CATEGORIES_EN[i])}
              className={[
                "pill border transition-all text-xs font-semibold",
                (ar ? cat === c : cat === CATEGORIES_EN[i])
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400"
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="text-xs text-slate-400 mb-4">
          {ar ? `${filtered.length} نتيجة` : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
        </div>

        {/* Prompt cards */}
        {filtered.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3" aria-hidden="true">📭</div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {ar ? "لا توجد موجّهات تطابق بحثك" : "No prompts match your search"}
            </p>
            <a href="/workspace" className="mt-4 inline-block btn-primary text-sm">
              {ar ? "ابدأ في مساحة العمل" : "Start in Workspace"}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <PromptCard
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                copiedId={copied}
                ar={ar}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onStar={() => star(entry.id)}
                onRemove={() => remove(entry.id)}
                onCopy={(t) => copy(t, entry.id)}
                onTry={() => tryInWorkspace(entry.raw)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PromptCard({
  entry, expanded, copiedId, ar, onToggle, onStar, onRemove, onCopy, onTry
}: {
  entry: LocalHistoryEntry;
  expanded: boolean;
  copiedId: string | null;
  ar: boolean;
  onToggle: () => void;
  onStar: () => void;
  onRemove: () => void;
  onCopy: (t: string) => void;
  onTry: () => void;
}) {
  const date = new Date(entry.ts).toLocaleDateString(ar ? "ar-AE" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const catLabel = ar
    ? (INTENT_TO_CAT_AR[entry.intent ?? "other"] ?? "أخرى")
    : (INTENT_TO_CAT_EN[entry.intent ?? "other"] ?? "Other");

  return (
    <div className={`card transition-all ${expanded ? "shadow-card-hover" : ""} p-0 overflow-hidden`}>
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full text-start flex items-start gap-3 p-4"
      >
        <span className="mt-0.5 w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm flex-shrink-0 font-bold">
          {catLabel[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-full">
              {catLabel}
            </span>
            {entry.bookmarked && <span className="text-xs text-amber-500" aria-label="starred">⭐</span>}
            <span className="text-xs text-slate-400 dark:text-slate-500">{date}</span>
          </div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 font-medium truncate">
            {entry.raw.slice(0, 120)}{entry.raw.length > 120 ? "…" : ""}
          </p>
          {entry.final_prompt && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              → {entry.final_prompt.slice(0, 80)}…
            </p>
          )}
        </div>
        <span className="text-slate-300 dark:text-slate-600 text-xs mt-1 flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
          {/* Raw prompt */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-3 mb-1">
              {ar ? "الموجِّه الأصلي" : "Original Prompt"}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {entry.raw}
            </p>
          </div>

          {entry.final_prompt && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                {ar ? "الموجِّه المُحسَّن" : "Refined Prompt"}
              </div>
              <pre className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
                {entry.final_prompt}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={onTry} className="btn-primary text-xs px-3 py-1.5">
              ▶ {ar ? "جرّب في مساحة العمل" : "Try in Workspace"}
            </button>
            <button
              onClick={() => onCopy(entry.final_prompt ?? entry.raw)}
              className="btn-ghost text-xs border border-slate-200 dark:border-slate-700 px-3 py-1.5"
            >
              {copiedId === entry.id ? "✓" : "📋"} {ar ? "نسخ" : "Copy"}
            </button>
            <button onClick={onStar} className="btn-ghost text-xs border border-slate-200 dark:border-slate-700 px-3 py-1.5">
              {entry.bookmarked ? "★ " : "☆ "}{ar ? "نجّم" : "Star"}
            </button>
            <button onClick={onRemove} className="btn-ghost text-xs border border-rose-100 dark:border-rose-900/40 text-rose-500 px-3 py-1.5">
              🗑 {ar ? "حذف" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
