"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  FileSliders,
  Languages,
  Gauge,
  RotateCcw,
  BadgeCheck,
  Sparkles,
  ArrowUp,
  ChevronDown,
  Mic,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/presentiq/i18n/context";
import { Frame4D } from "@/components/presentiq/ui/Frame4D";
import { InstallApp } from "@/components/presentiq/ui/InstallApp";
import { TEMPLATES } from "@/lib/presentiq/templates/registry";
import { Magnetic, Reveal, Tilt } from "@/components/presentiq/ui/motion";

const FEATURES: { titleKey: any; bodyKey: any; Icon: LucideIcon }[] = [
  { titleKey: "feat.brand.title",    bodyKey: "feat.brand.body",    Icon: ShieldCheck },
  { titleKey: "feat.pptx.title",     bodyKey: "feat.pptx.body",     Icon: FileSliders },
  { titleKey: "feat.rtl.title",      bodyKey: "feat.rtl.body",      Icon: Languages },
  { titleKey: "feat.quality.title",  bodyKey: "feat.quality.body",  Icon: Gauge },
  { titleKey: "feat.regen.title",    bodyKey: "feat.regen.body",    Icon: RotateCcw },
  { titleKey: "feat.evidence.title", bodyKey: "feat.evidence.body", Icon: BadgeCheck },
];

type TplCategory = "all" | "pitch" | "proposal" | "boardroom" | "training" | "tender";

// Categorise the registry templates so the landing's chip filter works.
const TPL_CATEGORY: Record<string, Exclude<TplCategory, "all">> = {
  scqa_brief:             "proposal",
  boardroom_decision:     "boardroom",
  investor_business_case: "pitch",
  uae_gov_committee:      "boardroom",
  qbr_steering:           "boardroom",
  okr_review:             "boardroom",
  tender_response:        "tender",
  training_bilingual:     "training",
  pestel_strategy:        "proposal",
};

export function Hero() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [mode, setMode] = useState<"classic" | "studio">("classic");
  const [prompt, setPrompt] = useState("");
  const [slides, setSlides] = useState(5);
  const [tplCat, setTplCat] = useState<TplCategory>("all");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Global keyboard shortcut: Cmd/Ctrl + K focuses the composer.
  // Standard "jump to input" muscle memory from Gamma / Linear / Slack.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mac = (e.metaKey && !e.ctrlKey);
      const win = (e.ctrlKey && !e.metaKey);
      if ((mac || win) && e.key.toLowerCase() === "k") {
        // Ignore if the user is already typing in an input.
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        textareaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const placeholder = useMemo(
    () => (lang === "ar"
      ? "مثلاً: ١٠ شرائح عن التحول الرقمي للجنة التوجيه..."
      : "E.g. 10 slides on climate change for the steering committee…"),
    [lang],
  );

  const cats: { id: TplCategory; labelEn: string; labelAr: string }[] = [
    { id: "all",       labelEn: "All",            labelAr: "الكل" },
    { id: "pitch",     labelEn: "Pitch Deck",     labelAr: "عرض تأسيسي" },
    { id: "proposal",  labelEn: "Project Proposal", labelAr: "عرض مشروع" },
    { id: "boardroom", labelEn: "Boardroom",      labelAr: "مجلس الإدارة" },
    { id: "training",  labelEn: "Training",       labelAr: "تدريب" },
    { id: "tender",    labelEn: "Tender",         labelAr: "عطاء" },
  ];

  function submit() {
    if (submitting) return;
    setSubmitting(true);
    const v = prompt.trim();
    const params = new URLSearchParams();
    if (v) params.set("prompt", v);
    params.set("slides", String(slides));
    params.set("mode", mode);
    // No await needed; router.push is fire-and-forget. The state flag
    // stops double-submits (double-tap / rapid Enter) between the click
    // and the route transition.
    router.push(`/presentiq/projects/new?${params.toString()}`);
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const filteredCards = TEMPLATES.filter((tp) =>
    tplCat === "all" ? true : TPL_CATEGORY[tp.code] === tplCat,
  );

  return (
    <div className="space-y-16">
      {/* ── Hero — composer + brand pill ─────────────────────────── */}
      <section className="pq-composer-hero" style={{ position: "relative", isolation: "isolate" }}>
        <div className="pq-mesh pq-aurora-flow" aria-hidden />
        <div className="relative" style={{ zIndex: 1 }}>
          {/* Marketing pill — replaces the earlier AuroraWord wordmark
              (which repeated the brand already shown in the header and
              rendered nearly invisibly on dark). This pill is a scannable
              value-prop instead. */}
          <div className="pq-rise" style={{ textAlign: "center", marginBottom: "1rem" }}>
            <span className="pq-hero-pill">
              <Sparkles aria-hidden size={12} strokeWidth={2.4} />
              <span>{t("brand.promise")}</span>
              <span className="pq-hero-pill-dot" aria-hidden />
              <span className="pq-hero-pill-meta">v0.5</span>
            </span>
          </div>

          {/* Mode tabs */}
          <div className="pq-mode-tabs pq-rise pq-rise-2" role="tablist" aria-label="Generation mode">
            <button
              role="tab"
              type="button"
              data-active={mode === "classic" ? "true" : "false"}
              onClick={() => setMode("classic")}
              className="pq-mode-tab"
            >
              <span aria-hidden>≡</span> {lang === "ar" ? "كلاسيكي" : "Classic"}
            </button>
            <button
              role="tab"
              type="button"
              data-active={mode === "studio" ? "true" : "false"}
              onClick={() => setMode("studio")}
              className="pq-mode-tab"
            >
              <span aria-hidden>◆</span>
              {lang === "ar" ? "استوديو" : "Studio"}
            </button>
          </div>

          {/* Hero question */}
          <h1 className="pq-composer-hero-h1 pq-rise pq-rise-3">
            <Sparkles className="pq-emoji" aria-hidden size={28} />
            <span className="pq-aurora-underline">
              {lang === "ar" ? "من أين نبدأ؟" : "Where should we begin?"}
            </span>
          </h1>

          {/* Tagline */}
          <p
            className="pq-rise pq-rise-3"
            style={{
              textAlign: "center",
              marginTop: "0.5rem",
              marginBottom: "1.5rem",
              color: "var(--pq-text-secondary)",
              fontSize: "0.95rem",
              lineHeight: 1.5,
            }}
          >
            {t("brand.tagline")}
          </p>

          {/* Composer */}
          <div className="pq-liquid-card pq-composer-card pq-rise pq-rise-4" dir={lang === "ar" ? "rtl" : "ltr"}>
            <textarea
              ref={textareaRef}
              className="pq-composer-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onTextareaKey}
              placeholder={placeholder}
              aria-label={placeholder}
              aria-describedby="pq-composer-hint"
              rows={2}
            />
            <div className="pq-composer-controls">
              <button
                type="button"
                className="pq-liquid-icon-btn"
                aria-label={lang === "ar" ? "إضافة مصدر" : "Attach a source"}
                onClick={() => router.push(`/presentiq/projects/new?step=sources`)}
                title={lang === "ar" ? "إضافة مصدر" : "Attach"}
              >
                <Plus aria-hidden size={16} strokeWidth={2.2} />
              </button>
              <span className="spacer" />
              <label className="pq-composer-slidesel">
                <select
                  value={slides}
                  onChange={(e) => setSlides(Number(e.target.value))}
                  aria-label={lang === "ar" ? "عدد الشرائح" : "Slide count"}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} {lang === "ar" ? "شريحة" : (n === 1 ? "slide" : "slides")}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden size={14} />
              </label>
              <button
                type="button"
                className="pq-liquid-icon-btn"
                aria-label={lang === "ar" ? "إدخال صوتي" : "Voice input"}
                title={lang === "ar" ? "قريباً" : "Coming soon"}
              >
                <Mic aria-hidden size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="pq-composer-send"
                onClick={submit}
                disabled={submitting}
                aria-busy={submitting}
                aria-label={lang === "ar" ? "ابدأ التوليد" : "Start generation"}
                title={lang === "ar" ? "ابدأ" : "Start"}
              >
                <ArrowUp aria-hidden size={16} strokeWidth={2.4} />
              </button>
            </div>
            {/* Keyboard hint. Announced by aria-describedby on the
                textarea so screen readers pick it up on focus, and
                visually shown as a subtle shortcut chip. */}
            <div id="pq-composer-hint" className="pq-composer-hint" aria-live="polite">
              <kbd>{lang === "ar" ? "⌘" : "⌘"}</kbd>
              <span>+</span>
              <kbd>K</kbd>
              <span className="pq-composer-hint-sep" aria-hidden>·</span>
              <span>{lang === "ar" ? "للتركيز" : "to focus"}</span>
              <span className="pq-composer-hint-sep" aria-hidden>·</span>
              <kbd>{lang === "ar" ? "⌘" : "⌘"}</kbd>
              <span>+</span>
              <kbd>{lang === "ar" ? "Enter" : "Enter"}</kbd>
              <span className="pq-composer-hint-sep" aria-hidden>·</span>
              <span>{lang === "ar" ? "للإرسال" : "to send"}</span>
            </div>
          </div>

          {/* CTA row underneath the composer */}
          <div className="pq-hero-cta-row pq-rise pq-rise-5" style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              aria-busy={submitting}
              className="pq-btn pq-btn-liquid pq-btn-liquid-primary pq-btn-liquid-pill"
              style={{ padding: "0.85rem 1.6rem", fontSize: "0.95rem" }}
            >
              {submitting
                ? (lang === "ar" ? "جارٍ الفتح…" : "Opening…")
                : (<>{t("land.cta.start")} <span aria-hidden>→</span></>)}
            </button>
            <Magnetic as="a" href="/presentiq/dashboard" className="pq-btn pq-btn-liquid pq-btn-liquid-pill" style={{ padding: "0.85rem 1.4rem", fontSize: "0.9rem" }}>
              {t("land.cta.dashboard")}
            </Magnetic>
          </div>

          {/* Trust chips row — reassurance under the CTAs */}
          <ul className="pq-hero-trust pq-rise pq-rise-5" aria-label={lang === "ar" ? "شهادات الثقة" : "Trust marks"}>
            <li>
              <ShieldCheck aria-hidden size={13} strokeWidth={2.2} />
              <span>{lang === "ar" ? "مراجعة المصادر" : "Source review"}</span>
            </li>
            <li>
              <BadgeCheck aria-hidden size={13} strokeWidth={2.2} />
              <span>{lang === "ar" ? "تحرير محلي اختياري" : "Local authoring option"}</span>
            </li>
            <li>
              <Languages aria-hidden size={13} strokeWidth={2.2} />
              <span>{lang === "ar" ? "عربيّة RTL أصيلة" : "Arabic RTL native"}</span>
            </li>
            <li>
              <Gauge aria-hidden size={13} strokeWidth={2.2} />
              <span>{lang === "ar" ? "تصدير قابل للتحرير" : "Editable exports"}</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Templates strip ───────────────────────────────────────── */}
      <Reveal as="section" className="pq-templates" variant="single">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="text-2xl md:text-3xl font-semibold" style={{ color: "var(--pq-text-main)" }}>
            {t("tpl.title")}
          </h2>
          <Link
            href="/presentiq/templates"
            className="pq-nav-link"
            style={{ padding: "0.4rem 0.8rem" }}
          >
            {lang === "ar" ? "عرض الكل" : "Browse all"} →
          </Link>
        </div>

        <div className="pq-tpl-chips" role="tablist" aria-label="Template categories">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              data-active={tplCat === c.id ? "true" : "false"}
              className="pq-tpl-chip"
              onClick={() => setTplCat(c.id)}
            >
              {lang === "ar" ? c.labelAr : c.labelEn}
            </button>
          ))}
        </div>

        <Reveal variant="stagger" className="pq-tpl-grid">
          {/* Create blank */}
          <Tilt as="a" href="/presentiq/projects/new" className="pq-tpl-card pq-tpl-card-blank" max={4}>
            <div className="pq-tpl-card-cover" style={{ background: "transparent" }}>
              <div className="text-center">
                <div style={{ fontSize: "1.6rem", color: "var(--pq-text-secondary)" }} aria-hidden>＋</div>
                <div style={{ marginTop: "0.5rem", color: "var(--pq-text-secondary)", fontWeight: 600 }}>
                  {lang === "ar" ? "إنشاء فارغ" : "Create Blank"}
                </div>
              </div>
            </div>
            <div className="pq-tpl-card-foot">
              <div className="pq-tpl-card-title">{lang === "ar" ? "ابدأ من الصفر" : "Start from scratch"}</div>
              <div className="pq-tpl-card-sub">{lang === "ar" ? "أنت تتحكم بالكامل" : "Full control"}</div>
            </div>
          </Tilt>

          {filteredCards.map((tp) => {
            const title = lang === "ar" ? tp.nameAr : tp.nameEn;
            return (
              <Tilt
                key={tp.code}
                as="a"
                href={`/presentiq/projects/new?template=${tp.code}`}
                className="pq-tpl-card"
                max={5}
              >
                <div className="pq-tpl-card-cover" data-tone={tp.tone}>
                  <span>{title}</span>
                </div>
                <div className="pq-tpl-card-foot">
                  <div className="pq-tpl-card-title">{title}</div>
                  <div className="pq-tpl-card-sub">
                    {tp.framework} · {tp.defaultSlides} {lang === "ar" ? "شريحة" : "slides"}
                  </div>
                </div>
              </Tilt>
            );
          })}
        </Reveal>
      </Reveal>

      {/* ── Capability strip — verifiable platform facts only ───── */}
      <Reveal as="section" className="pq-stats pq-stats-flat" variant="stagger">
        <div className="pq-stat">
          <div className="pq-stat-num">EN · AR</div>
          <div className="pq-stat-label">{t("hero.stat.langs")}</div>
        </div>
        <div className="pq-stat">
          <div className="pq-stat-num">10</div>
          <div className="pq-stat-label">{t("hero.stat.dims")}</div>
        </div>
        <div className="pq-stat">
          <div className="pq-stat-num">PPTX</div>
          <div className="pq-stat-label">{lang === "ar" ? "مخرج قابل للتحرير" : "Editable export"}</div>
        </div>
        <div className="pq-stat">
          <div className="pq-stat-num">RTL</div>
          <div className="pq-stat-label">{lang === "ar" ? "تخطيطات معكوسة" : "Mirrored layouts"}</div>
        </div>
      </Reveal>

      {/* ── How it works ──────────────────────────────────────────── */}
      <Reveal as="section" variant="stagger">
        <div className="pq-howit">
          {[1, 2, 3].map((n) => (
            <div key={n} className="pq-howit-step">
              <div className="pq-howit-num">{n}</div>
              <div className="text-sm" style={{ color: "var(--pq-text-secondary)", lineHeight: 1.4 }}>
                {t(`hero.howit.step${n}` as any)}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Removed: "Built for" trust marquee — the labels were audience
          categories, not real customer logos, so they added visual
          weight without adding trust. Verified capability labels live in the hero chip row and
          the footer. */}

      {/* ── Differentiator features ───────────────────────────────── */}
      <section className="pq-section">
        <div className="pq-section-head">
          <div className="pq-section-eyebrow">
            {lang === "ar" ? "الحوكمة أولاً" : "Governance first"}
          </div>
          <h2 className="pq-section-title">
            {lang === "ar"
              ? "كل ما يحتاجه مجلس الإدارة"
              : "Everything a boardroom needs"}
          </h2>
          <p className="pq-section-sub">
            {lang === "ar"
              ? "منصّة وكلاء تلتزم بهويّتك، وتضبط أدلّتك، وتنتج مخرجات قابلة للتحرير."
              : "An agent platform that respects your brand, controls your evidence, and produces truly editable output."}
          </p>
        </div>
        <Reveal
          as="div"
          variant="stagger"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((f) => {
            const Icon = f.Icon;
            return (
              <Tilt key={String(f.titleKey)} max={4}>
                <Frame4D className="p-6 h-full">
                  <div className="pq-feat-icon" aria-hidden>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <h3 className="text-base font-semibold mt-4" style={{ color: "var(--pq-text-main)" }}>
                    {t(f.titleKey)}
                  </h3>
                  <p className="text-sm mt-2" style={{ color: "var(--pq-text-secondary)", lineHeight: 1.55 }}>
                    {t(f.bodyKey)}
                  </p>
                </Frame4D>
              </Tilt>
            );
          })}
        </Reveal>
      </section>

      {/* Removed: "What's new in v0.5" panel — release notes belong on
          /changelog. Duplicating them on the landing added no signup
          value and drifted out of sync every version. */}

      {/* Removed: testimonials block — the three quotes carried
          fabricated names and roles ("Head of Strategy at Consulting
          firm"). Fake social proof erodes trust rather than building
          it. This block returns only when we have real, cited,
          attributable customer quotes with permission to publish. */}

      {/* ── Pricing preview ──────────────────────────────────────── */}
      <section className="pq-section">
        <div className="pq-section-head">
          <div className="pq-section-eyebrow">
            {lang === "ar" ? "الأسعار" : "Pricing"}
          </div>
          <h2 className="pq-section-title">
            {lang === "ar" ? "خطط تنمو معك" : "Plans that grow with you"}
          </h2>
          <p className="pq-section-sub">
            {lang === "ar"
              ? "ابدأ مجّاناً. رقّي الاشتراك عندما يتطلّب مجلس الإدارة ذلك."
              : "Start free. Upgrade when the boardroom asks for it."}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              tier: lang === "ar" ? "التجربة" : "Trial",
              price: lang === "ar" ? "مجّاني" : "Free",
              sub: lang === "ar" ? "دون بطاقة ائتمان" : "No credit card",
              feats: lang === "ar"
                ? ["٣ عروض شهرياً", "قوالب أساسية", "تصدير PPTX"]
                : ["3 decks / month", "Core templates", "PPTX export"],
              cta: lang === "ar" ? "جرّب الآن" : "Try free",
              highlight: false,
            },
            {
              tier: lang === "ar" ? "الفريق" : "Team",
              price: lang === "ar" ? "٤٩$ / شهر" : "$49/mo",
              sub: lang === "ar" ? "لكل مقعد" : "per seat",
              feats: lang === "ar"
                ? ["عروض غير محدودة", "حوكمة الهويّة", "دعم عربي RTL", "لوحة الجودة"]
                : ["Unlimited decks", "Brand governance", "Arabic RTL", "Quality board"],
              cta: lang === "ar" ? "ابدأ الفريق" : "Start Team",
              highlight: true,
            },
            {
              tier: lang === "ar" ? "المؤسّسة" : "Enterprise",
              price: lang === "ar" ? "تواصل معنا" : "Talk to us",
              sub: lang === "ar" ? "SSO · SLA · مقيمة داخل الإمارات" : "SSO · SLA · UAE-resident",
              feats: lang === "ar"
                ? ["استضافة مخصّصة", "تدقيق كامل", "تكامل SSO", "مدير حساب"]
                : ["Dedicated hosting", "Full audit trail", "SSO integration", "Named CSM"],
              cta: lang === "ar" ? "تواصل" : "Contact sales",
              highlight: false,
            },
          ].map((p, i) => (
            <div key={i} className={`pq-price-card ${p.highlight ? "is-featured" : ""}`}>
              {p.highlight && (
                <div className="pq-price-badge">{lang === "ar" ? "الأكثر شعبيّة" : "Most popular"}</div>
              )}
              <div className="pq-price-tier">{p.tier}</div>
              <div className="pq-price-num">{p.price}</div>
              <div className="pq-price-sub">{p.sub}</div>
              <ul className="pq-price-list">
                {p.feats.map((f, j) => (
                  <li key={j}>
                    <BadgeCheck size={14} strokeWidth={2.4} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.highlight ? "/presentiq/projects/new" : "/presentiq/pricing"}
                className={`pq-price-cta ${p.highlight ? "is-primary" : ""}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ preview ──────────────────────────────────────────── */}
      <section className="pq-section">
        <div className="pq-section-head">
          <div className="pq-section-eyebrow">
            {lang === "ar" ? "الأسئلة" : "FAQ"}
          </div>
          <h2 className="pq-section-title">
            {lang === "ar" ? "أسئلة تُطرح كثيراً" : "Frequently asked"}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              q: lang === "ar" ? "هل مخرج PPTX قابل للتحرير فعلاً؟" : "Is the PPTX really editable?",
              a: lang === "ar"
                ? "نعم. مربّعات نص، أشكال، جداول، ورسوم بيانية حقيقية. لا صور ثابتة."
                : "Yes. Real text boxes, shapes, tables and charts. Never screenshots.",
            },
            {
              q: lang === "ar" ? "هل تدعمون العربية RTL؟" : "Do you support Arabic RTL?",
              a: lang === "ar"
                ? "دعم أصيل: تخطيطات معكوسة، خطوط عربية، ومصطلحات مؤسّسية."
                : "Native: mirrored layouts, Arabic typefaces, and formal corporate terminology.",
            },
            {
              q: lang === "ar" ? "أين تُخزَّن بياناتنا؟" : "Where is our data stored?",
              a: lang === "ar"
                ? "الخيار الافتراضي: مراكز بيانات مقيمة داخل الإمارات. متاح أيضاً استضافة مخصّصة."
                : "Default: UAE-resident data centres. Dedicated hosting is available on Enterprise.",
            },
            {
              q: lang === "ar" ? "كيف تتعاملون مع الأدلّة؟" : "How do you handle evidence?",
              a: lang === "ar"
                ? "كلّ عبارة مصنّفة (حقيقة / تقدير / مطلوب مُدخل) ولا نختلق أرقاماً."
                : "Every claim is classified (fact / assessment / input required); we never fabricate figures.",
            },
          ].map((f, i) => (
            <details key={i} className="pq-faq-item">
              <summary>
                <span>{f.q}</span>
                <span className="pq-faq-mark" aria-hidden>+</span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Get the app (PWA install / Android home-screen) ──────── */}
      <InstallApp />

      {/* ── Final CTA banner ─────────────────────────────────────── */}
      <section className="pq-final-cta">
        <div className="pq-final-cta-inner">
          <h2 className="pq-final-cta-title">
            {lang === "ar"
              ? "من الفكرة إلى مجلس الإدارة، خلال دقائق."
              : "From spark to boardroom, in minutes."}
          </h2>
          <p className="pq-final-cta-sub">
            {lang === "ar"
              ? "ابدأ عرضك الأول مجّاناً، بلا بطاقة ائتمان."
              : "Start your first deck free. No credit card required."}
          </p>
          <div className="pq-final-cta-row">
            <Link href="/presentiq/projects/new" className="pq-btn pq-btn-liquid pq-btn-liquid-primary pq-btn-liquid-pill">
              {t("land.cta.start")} <span aria-hidden>→</span>
            </Link>
            <Link href="/presentiq/pricing" className="pq-btn pq-btn-liquid pq-btn-liquid-pill">
              {lang === "ar" ? "شاهد الأسعار" : "See pricing"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
