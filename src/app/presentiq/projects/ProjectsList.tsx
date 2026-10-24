"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/presentiq/i18n/context";
import { Frame4D } from "@/components/presentiq/ui/Frame4D";

type Project = {
  id: string;
  title: string;
  status: string;
  presentation_mode: string;
  language_mode: string;
  updated_at: string;
};

export function ProjectsList({ items }: { items: Project[] }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const statuses = useMemo(
    () => Array.from(new Set(items.map((p) => p.status))).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return items.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      return [p.title, p.presentation_mode, p.language_mode]
        .some((v) => (v ?? "").toLocaleLowerCase().includes(q));
    });
  }, [items, query, status]);

  const filtered = query.trim() !== "" || status !== "all";
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ar" ? "ar-AE" : "en-AE");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--pq-text)" }}>
          {t("proj.title")}
        </h1>
        <Link href="/presentiq/projects/new" className="pq-btn pq-btn-primary">＋ {t("nav.new")}</Link>
      </header>

      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="flex-1 min-w-0">
            <span className="sr-only">{t("proj.search")}</span>
            <input
              type="search"
              className="pq-input w-full"
              placeholder={t("proj.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="sm:w-56">
            <span className="sr-only">{t("proj.filter.status")}</span>
            <select
              className="pq-input w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">{t("proj.filter.all")}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </select>
          </label>
          <p className="text-xs whitespace-nowrap" style={{ color: "var(--pq-text-mute)" }} aria-live="polite">
            {t("proj.showing")} {visible.length} {t("proj.of")} {items.length}
          </p>
        </div>
      )}

      <Frame4D className="p-0 overflow-hidden" interactive={false}>
        <div className="px-4 sm:px-6 py-4">
          {items.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--pq-text-soft)" }}>{t("dash.empty")}</div>
          ) : visible.length === 0 ? (
            <div className="text-sm py-6 text-center space-y-3" style={{ color: "var(--pq-text-soft)" }}>
              <p>{t("proj.none_match")}</p>
              {filtered && (
                <button
                  type="button"
                  className="pq-btn"
                  onClick={() => { setQuery(""); setStatus("all"); }}
                >
                  {t("proj.clear")}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: stacked cards so nothing is clipped on narrow screens */}
              <ul className="md:hidden divide-y" style={{ borderColor: "rgba(66,87,34,0.14)" }}>
                {visible.map((p) => (
                  <li key={p.id} className="py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/presentiq/projects/${p.id}`}
                        className="font-medium hover:underline min-w-0 break-words"
                        style={{ color: "var(--pq-text)" }}
                      >
                        {p.title}
                      </Link>
                      <span className={`pq-status pq-status-${statusClass(p.status)} shrink-0`}>{humanize(p.status)}</span>
                    </div>
                    <div className="text-xs" style={{ color: "var(--pq-text-mute)" }}>
                      {humanize(p.presentation_mode)} · {humanize(p.language_mode)}
                    </div>
                    <div className="text-xs" style={{ color: "var(--pq-text-mute)" }}>
                      {t("proj.col.updated")}: {formatDate(p.updated_at)}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: full table */}
              <table className="hidden md:table w-full text-sm">
                <thead className="text-xs uppercase tracking-wider" style={{ color: "var(--pq-text-mute)" }}>
                  <tr>
                    <th className="text-start py-2">{t("proj.col.title")}</th>
                    <th className="text-start">{t("proj.col.mode")}</th>
                    <th className="text-start">{t("proj.col.lang")}</th>
                    <th className="text-start">{t("proj.col.status")}</th>
                    <th className="text-start">{t("proj.col.updated")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "rgba(66,87,34,0.14)" }}>
                  {visible.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pe-4">
                        <Link
                          href={`/presentiq/projects/${p.id}`}
                          className="font-medium hover:underline"
                          style={{ color: "var(--pq-text)" }}
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="pe-4">{humanize(p.presentation_mode)}</td>
                      <td className="pe-4">{humanize(p.language_mode)}</td>
                      <td className="pe-4"><span className={`pq-status pq-status-${statusClass(p.status)}`}>{humanize(p.status)}</span></td>
                      <td style={{ color: "var(--pq-text-mute)" }}>{formatDate(p.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Frame4D>
    </div>
  );
}

/** Turns stored identifiers such as `corporate_boardroom` into `Corporate boardroom`. */
function humanize(value: string): string {
  if (!value) return "";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusClass(s: string): "draft" | "ready" | "generating" | "blueprint" {
  if (s === "ready" || s === "approved" || s === "exported") return "ready";
  if (s === "generating" || s === "ingesting") return "generating";
  if (s === "blueprint_ready") return "blueprint";
  return "draft";
}
