"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/presentiq/i18n/context";
import { LangToggle } from "@/components/presentiq/ui/LangToggle";
import { SiteFooter } from "@/components/presentiq/ui/SiteFooter";
import { Logo } from "@/components/presentiq/ui/Logo";
import { ThemeToggle } from "@/components/presentiq/ui/ThemeToggle";

export function PresentIqShell({ children }: { children: ReactNode }) {
  const { t, dir, lang } = useI18n();
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  // Two parallel nav sets:
  //  - The "marketing" header (Product / Pricing / About / etc.), shown on the
  //    public landing & marketing-style pages.
  //  - The "app" header (Dashboard / Projects / …), shown inside the app.
  const isMarketing =
    pathname === "/presentiq" ||
    pathname === "/presentiq/" ||
    pathname === "/presentiq/about" ||
    pathname === "/presentiq/pricing";
  const APP_NAV: { href: string; key: any }[] = [
    { href: "/presentiq/dashboard",  key: "nav.dashboard" },
    { href: "/presentiq/projects",   key: "nav.projects" },
    { href: "/presentiq/templates",  key: "nav.templates" },
    { href: "/presentiq/brand-kits", key: "nav.brandkits" },
    { href: "/presentiq/changelog",  key: "nav.changelog" },
    { href: "/presentiq/contact",    key: "nav.contact" },
  ];
  const MARKETING_NAV: { href: string; key: any }[] = [
    { href: "/presentiq#product",    key: "marketing.nav.product" },
    { href: "/presentiq/templates",  key: "nav.templates" },
    { href: "/presentiq/pricing",    key: "marketing.nav.pricing" },
    { href: "/presentiq/about",      key: "marketing.nav.about" },
    { href: "/presentiq/changelog",  key: "nav.changelog" },
    { href: "/presentiq/contact",    key: "nav.contact" },
  ];
  const NAV = isMarketing ? MARKETING_NAV : APP_NAV;

  const isActive = (href: string) =>
    !href.includes("#") && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Skip-to-content link. Visible only when the tab-ring lands on
          it (keyboard users), invisible for the mouse path. Required
          for WCAG 2.1 SC 2.4.1 — Bypass Blocks. */}
      <a href="#main" className="pq-skip-link">
        {lang === "ar" ? "تخطّي إلى المحتوى" : "Skip to content"}
      </a>
      <header
        className="pq-header sticky top-0 z-30"
        style={{
          background: "rgba(10,14,42,0.78)",
          backdropFilter: "blur(16px) saturate(1.4)",
          borderBottom: "1px solid var(--pq-border-soft)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/presentiq"
            className="flex items-center gap-2 shrink-0 min-w-0"
            aria-label="Pitchora home"
          >
            <Logo variant="horizontal" height={24} className="pq-header-logo" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" aria-label="Primary">
            {NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className="pq-nav-link"
                  data-active={active ? "true" : "false"}
                >
                  {t(n.key)}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <LangToggle />
            {/* "Log in" pill removed in v0.4.3 — auth flow isn't shipped yet,
                so the pill led nowhere meaningful. Re-add when /login is real. */}
            <span className="hidden md:block">
            <Link
              href="/presentiq/source-studio"
              className="pq-btn pq-btn-liquid pq-btn-liquid-primary pq-btn-liquid-pill"
              style={{ padding: "0.55rem 1.05rem", fontSize: "0.85rem" }}
            >
              <span aria-hidden>＋</span> {lang === "ar" ? "استوديو المصادر" : "Source Studio"}
            </Link>
            </span>
            <button
              type="button"
              className="lg:hidden pq-btn pq-btn-ghost"
              style={{ padding: "0.45rem 0.65rem" }}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav
            className="lg:hidden border-t"
            style={{
              borderColor: "var(--pq-border-soft)",
              background: "rgba(7,16,10,0.95)",
            }}
            aria-label="Mobile primary"
          >
            <div className="mx-auto max-w-7xl px-4 py-2 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="pq-nav-link"
                  data-active={isActive(n.href) ? "true" : "false"}
                  style={{ padding: "0.65rem 0.85rem" }}
                >
                  {t(n.key)}
                </Link>
              ))}
              <Link
                href="/presentiq/source-studio"
                onClick={() => setMobileOpen(false)}
                className="pq-btn pq-btn-primary mt-2 justify-center"
              >
                <span aria-hidden>＋</span> {lang === "ar" ? "استوديو المصادر" : "Source Studio"}
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6 py-10 flex-1 w-full">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
