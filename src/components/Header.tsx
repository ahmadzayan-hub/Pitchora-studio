"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import Logo from "@/components/Logo";
import Wordmark from "@/components/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";
import ShareApp from "@/components/ShareApp";
import Link from "next/link";

export default function Header() {
  const { t, locale, setLocale } = useI18n();
  const otherLocale = locale === "en" ? "ar" : "en";
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0" aria-label={t("app.name")}>
          <Logo className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0" />
          <Wordmark />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <a href="/workspace" className="btn-ghost">{t("nav.workspace")}</a>
          <a href="/templates" className="btn-ghost">{t("nav.templates")}</a>
          <a href="/learn" className="btn-ghost">{t("nav.learn")}</a>
          <a href="/history" className="btn-ghost">{t("nav.history")}</a>
          <a href="/settings" className="btn-ghost">{t("nav.settings")}</a>
          <a href="/login" className="btn-ghost">{t("nav.signin")}</a>
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
          <ShareApp />
          <ThemeToggle />
          <button
            onClick={() => setLocale(otherLocale)}
            className="btn-ghost border border-slate-200 dark:border-slate-700 text-xs"
            aria-label="Toggle language"
          >
            {t("lang.toggle")}
          </button>
        </nav>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setLocale(otherLocale)}
            className="btn-ghost border border-slate-200 dark:border-slate-700 text-xs px-2 py-1"
            aria-label="Toggle language"
          >
            {t("lang.toggle")}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost px-2 py-1"
            aria-label="Menu"
            aria-expanded={open}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
            <a href="/workspace" className="btn-ghost justify-start">{t("nav.workspace")}</a>
            <a href="/templates" className="btn-ghost justify-start">{t("nav.templates")}</a>
            <a href="/learn" className="btn-ghost justify-start">{t("nav.learn")}</a>
            <a href="/history" className="btn-ghost justify-start">{t("nav.history")}</a>
            <a href="/settings" className="btn-ghost justify-start">{t("nav.settings")}</a>
            <a href="/login" className="btn-ghost justify-start">{t("nav.signin")}</a>
            <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <ShareApp />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
