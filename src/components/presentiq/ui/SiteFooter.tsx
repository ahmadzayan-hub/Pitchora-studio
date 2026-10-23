"use client";

import Link from "next/link";
import { Mail, ShieldCheck, Star, Check } from "lucide-react";
import { useI18n } from "@/lib/presentiq/i18n/context";
import { Logo } from "@/components/presentiq/ui/Logo";
import { PQ_CONTACT_EMAIL } from "@/lib/presentiq/config";

// Brand-glyph SVGs — lucide-react 1.x dropped per-vendor brand icons.
const LinkedInGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 11.01-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>
  </svg>
);
const XGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2H21.5l-7.477 8.547L23 22h-6.91l-5.41-7.07L4.5 22H1.244l8-9.14L1 2h7.09l4.89 6.46L18.244 2zm-1.215 18.04h1.807L7.06 3.86H5.13l11.9 16.18z"/>
  </svg>
);

/**
 * Expanded site footer (Round-2 redesign, v0.6).
 *
 * The previous slim footer worked for in-app pages, but on the marketing
 * landing it left users nowhere to go once they scrolled to the bottom.
 * This layout keeps the brand + trust marks + social row (proven from
 * v0.4.2) and adds four sitemap columns (Product / Company / Resources /
 * Legal) so the landing has a proper closing chapter.
 */
export function SiteFooter() {
  const { t, lang } = useI18n();
  const trustParts = String(t("foot.trust")).split(" · ").filter(Boolean);

  const columns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    {
      title: lang === "ar" ? "المنتج" : "Product",
      links: [
        { label: lang === "ar" ? "القوالب" : "Templates",   href: "/presentiq/templates" },
        { label: lang === "ar" ? "الأسعار" : "Pricing",     href: "/presentiq/pricing" },
        { label: lang === "ar" ? "لوحة التحكم" : "Dashboard", href: "/presentiq/dashboard" },
        { label: lang === "ar" ? "هويات العلامة" : "Brand kits", href: "/presentiq/brand-kits" },
      ],
    },
    {
      title: lang === "ar" ? "الشركة" : "Company",
      links: [
        { label: lang === "ar" ? "من نحن" : "About",         href: "/presentiq/about" },
        { label: lang === "ar" ? "الجديد" : "Changelog",     href: "/presentiq/changelog" },
        { label: lang === "ar" ? "تواصل" : "Contact",        href: "/presentiq/contact" },
      ],
    },
    {
      title: lang === "ar" ? "المصادر" : "Resources",
      links: [
        { label: lang === "ar" ? "كيف يعمل" : "How it works", href: "/how-it-works" },
        { label: lang === "ar" ? "المميزات" : "Features",    href: "/features" },
        { label: lang === "ar" ? "الأسئلة" : "FAQ",           href: "/faq" },
      ],
    },
    {
      title: lang === "ar" ? "قانوني" : "Legal",
      links: [
        { label: lang === "ar" ? "الخصوصية" : "Privacy",     href: "/privacy" },
        { label: lang === "ar" ? "الشروط" : "Terms",         href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="pq-footer-slim mt-16" role="contentinfo">
      <div className="pq-footer-columns">
        <div className="pq-footer-brand-col">
          <Link href="/presentiq" aria-label="Pitchora home">
            <Logo variant="horizontal" height={24} />
          </Link>
          <p>{t("foot.tagline")}</p>
          <ul className="pq-footer-slim-trust" aria-label="Product capabilities" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {trustParts.map((label, i) => {
              const Icon = i === 0 ? ShieldCheck : i === 1 ? Star : Check;
              return (
                <li key={i} className="pq-footer-slim-pill">
                  <Icon aria-hidden size={13} strokeWidth={2.2} />
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="pq-footer-col-title">{col.title}</h3>
            <ul className="pq-footer-col-list">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="pq-footer-bottom">
        <div className="pq-footer-bottom-copy">{t("foot.copyright")}</div>
        <div className="pq-footer-bottom-social" aria-label="Social links">
          <a href="https://www.linkedin.com/company/tweenz" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="pq-social"><LinkedInGlyph /></a>
          <a href="https://x.com/tweenzAI" target="_blank" rel="noopener noreferrer" aria-label="X (formerly Twitter)" className="pq-social"><XGlyph /></a>
          <a href={`mailto:${PQ_CONTACT_EMAIL}`} aria-label="Email founder" className="pq-social"><Mail size={15} strokeWidth={2} /></a>
        </div>
      </div>
    </footer>
  );
}
