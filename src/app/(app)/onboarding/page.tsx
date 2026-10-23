"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnboardingData } from "@/lib/profile-input";
import { saveOnboarding } from "./request";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { GraduationCap, ChevronRight, ChevronLeft, Check } from "lucide-react";

const STEPS = ["welcome", "program", "goals", "preferences"] as const;
type Step = typeof STEPS[number];

export default function OnboardingPage() {
  const { t, dir } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    full_name: "",
    program_name: "MBA",
    university: "",
    gpa_scale: "4.0",
    study_hours_per_week: 15,
    primary_language: "en",
    goal: "gpa",
  });

  function set<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  async function finish() {
    setError(null);
    setDemoNotice(false);
    setSaving(true);
    try {
      const result = await saveOnboarding(data, t("error.generic"));
      if (result.demo) {
        setDemoNotice(true);
        return;
      }
      router.push("/dashboard");
    } catch (cause) {
      setError(cause instanceof TypeError ? t("error.network") : cause instanceof Error ? cause.message : t("error.generic"));
    } finally {
      setSaving(false);
    }
  }

  const isLast = step === STEPS.length - 1;
  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-teal-900 flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${i <= step ? "bg-white" : "bg-white/20"}`} style={{ width: i === step ? 40 : 20 }} />
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl">
          {/* Welcome */}
          {currentStep === "welcome" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900 rounded-2xl flex items-center justify-center mx-auto">
                <GraduationCap className="w-8 h-8 text-brand-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("onboarding.welcome.title")}</h1>
              <p className="text-slate-500 text-sm leading-relaxed">{t("onboarding.welcome.subtitle")}</p>
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 text-start">{t("onboarding.welcome.name")}</label>
                <input type="text" value={data.full_name} onChange={e => set("full_name", e.target.value)} placeholder={t("onboarding.welcome.namePlaceholder")} />
              </div>
            </div>
          )}

          {/* Program */}
          {currentStep === "program" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("onboarding.program.title")}</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("onboarding.program.program")}</label>
                <select value={data.program_name} onChange={e => set("program_name", e.target.value)}>
                  <option value="MBA">MBA</option>
                  <option value="Executive MBA">Executive MBA</option>
                  <option value="Part-time MBA">Part-time MBA</option>
                  <option value="Online MBA">Online MBA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("onboarding.program.university")}</label>
                <input type="text" value={data.university} onChange={e => set("university", e.target.value)} placeholder={t("onboarding.program.universityPlaceholder")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("onboarding.program.gpaScale")}</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["4.0", "100"] as const).map(scale => (
                    <button
                      key={scale}
                      onClick={() => set("gpa_scale", scale)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all
                        ${data.gpa_scale === scale ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400" : "border-slate-200 dark:border-slate-700 hover:border-brand-300 text-slate-700 dark:text-slate-300"}`}
                    >
                      {scale === "4.0" ? "4.0 Scale" : "100-Point Scale"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Goals */}
          {currentStep === "goals" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("onboarding.goals.title")}</h2>
              <p className="text-sm text-slate-500">{t("onboarding.goals.subtitle")}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "gpa", emoji: "🎯", label: t("onboarding.goals.gpa") },
                  { key: "skills", emoji: "🚀", label: t("onboarding.goals.skills") },
                  { key: "career", emoji: "💼", label: t("onboarding.goals.career") },
                  { key: "research", emoji: "🔬", label: t("onboarding.goals.research") },
                ].map(g => (
                  <button
                    key={g.key}
                    onClick={() => set("goal", g.key as OnboardingData["goal"])}
                    className={`p-4 rounded-xl border-2 text-start transition-all
                      ${data.goal === g.key ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-slate-200 dark:border-slate-700 hover:border-brand-300"}`}
                  >
                    <div className="text-2xl mb-2">{g.emoji}</div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{g.label}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("onboarding.goals.studyHours")}</label>
                <input
                  type="range" min={5} max={40} step={5}
                  value={data.study_hours_per_week}
                  onChange={e => set("study_hours_per_week", Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5h/week</span>
                  <span className="font-semibold text-brand-600">{data.study_hours_per_week}h/week</span>
                  <span>40h/week</span>
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          {currentStep === "preferences" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("onboarding.preferences.title")}</h2>
              <p className="text-sm text-slate-500">{t("onboarding.preferences.subtitle")}</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("onboarding.preferences.language")}</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ code: "en", label: "English", native: "English" }, { code: "ar", label: "Arabic", native: "العربية" }].map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => set("primary_language", lang.code as "en" | "ar")}
                      className={`p-4 rounded-xl border-2 text-center transition-all
                        ${data.primary_language === lang.code ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-slate-200 dark:border-slate-700 hover:border-brand-300"}`}
                    >
                      <p className="font-bold text-slate-900 dark:text-white">{lang.native}</p>
                      <p className="text-xs text-slate-400">{lang.label}</p>
                      {data.primary_language === lang.code && <Check className="w-4 h-4 text-brand-500 mx-auto mt-2" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-brand-50 dark:bg-brand-950/20 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400">
                {t("onboarding.preferences.readyMessage")}
              </div>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
          {demoNotice && (
            <div role="status" className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-slate-700 dark:bg-brand-950 dark:text-slate-200">
              <p>{dir === "rtl" ? "الوضع التجريبي: لم يتم حفظ بيانات الإعداد." : "Demo mode: your onboarding details have not been saved."}</p>
              <Link href="/dashboard" className="mt-2 inline-block underline">{dir === "rtl" ? "المتابعة إلى لوحة التحكم" : "Continue to dashboard"}</Link>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back")}
            </button>
            {isLast ? (
              <button onClick={finish} disabled={saving} className="btn-primary">
                {saving ? t("common.saving") : t("onboarding.finishBtn")}
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary">
                {t("common.next")}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
