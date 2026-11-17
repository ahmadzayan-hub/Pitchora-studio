"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { safeFetch } from "@/lib/safe-fetch";
import { BUILTIN_TEMPLATES, categoryLabel, type BuiltinTemplate } from "@/lib/builtin-templates";

interface ApiTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  body: { sections?: string[]; slots?: string[] };
}

export default function TemplatesPage() {
  const t = useT();
  const { locale } = useI18n();
  const [apiTemplates, setApiTemplates] = useState<ApiTemplate[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  // Best-effort: pull additional templates from the API. Failure is silent —
  // the built-in catalog always renders, so the page never errors.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await safeFetch<{ templates: ApiTemplate[] }>("/api/templates");
      if (!cancelled && r.ok && r.data) setApiTemplates(r.data.templates ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const allCategories = useMemo(() => {
    const set = new Set<string>(BUILTIN_TEMPLATES.map((b) => b.category));
    apiTemplates.forEach((a) => a.category && set.add(a.category));
    return Array.from(set).sort();
  }, [apiTemplates]);

  const visibleBuiltin = useMemo(() => {
    return BUILTIN_TEMPLATES.filter((b) => {
      if (category !== "all" && b.category !== category) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      const name = (locale === "ar" ? b.name_ar : b.name_en).toLowerCase();
      const desc = (locale === "ar" ? b.description_ar : b.description_en).toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [category, query, locale]);

  function tryStarter(b: BuiltinTemplate) {
    const text = locale === "ar" ? b.starter_ar : b.starter_en;
    sessionStorage.setItem("po_starter", JSON.stringify({ text, model: b.target_model }));
    // Intentional full navigation: the starter text is handed over via sessionStorage.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/workspace";
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("templates.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {locale === "ar"
              ? "ابدأ من قالب جاهز ثم خصّصه — جرّبها بدون تسجيل دخول."
              : "Start from a curated template, then tailor it — no sign-in needed."}
          </p>
        </div>
        <a href="/workspace" className="btn-ghost border border-slate-300">
          {t("templates.open_workspace")}
        </a>
      </div>

      <div className="mt-5 flex gap-2 flex-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "ar" ? "ابحث في القوالب…" : "Search templates…"}
          className="flex-1 min-w-[200px]"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{locale === "ar" ? "كل الفئات" : "All categories"}</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c as BuiltinTemplate["category"], locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {visibleBuiltin.map((b) => (
          <button
            key={b.id}
            onClick={() => tryStarter(b)}
            className="card text-start hover:shadow-md hover:border-brand-200 transition group focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{locale === "ar" ? b.name_ar : b.name_en}</div>
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">
                {categoryLabel(b.category, locale)}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {locale === "ar" ? b.description_ar : b.description_en}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {b.sections.map((s) => (
                <span key={s} className="text-xs bg-slate-100 px-2 py-0.5 rounded">{s}</span>
              ))}
            </div>
            <div className="mt-3 text-xs text-brand-700 opacity-0 group-hover:opacity-100 transition">
              {locale === "ar" ? "← اضغط للتجربة في مساحة العمل" : "Tap to try in the workspace →"}
            </div>
          </button>
        ))}

        {/* Optional: extra templates returned by the API */}
        {apiTemplates.map((tpl) => (
          <div key={tpl.id} className="card hover:shadow-md transition">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{tpl.name}</div>
              {tpl.is_public && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                  {t("templates.public")}
                </span>
              )}
            </div>
            {tpl.category && <div className="text-xs text-slate-500 mt-0.5">{tpl.category}</div>}
            {tpl.description && <p className="text-sm text-slate-600 mt-2">{tpl.description}</p>}
            {tpl.body?.sections && (
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.body.sections.map((s) => (
                  <span key={s} className="text-xs bg-slate-100 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
