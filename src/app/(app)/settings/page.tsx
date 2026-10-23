"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { User, Globe, Bell, Shield, Trash2, Download, Lock, Eye, EyeOff, CheckCircle, LogOut, GraduationCap, Sparkles } from "lucide-react";
import Link from "next/link";
import { saveProfileRequest, type EditableProfile } from "./request";

type Tab = "profile" | "language" | "notifications" | "privacy";

export default function SettingsPage() {
  const { t, locale, setLocale, dir } = useI18n();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<EditableProfile>({ full_name: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileDemo, setProfileDemo] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    fetch("/api/profile").then(r => { if (r.ok) r.json().then(setProfile); });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setProfileError(null);
    setProfileDemo(false);
    setSaving(true);
    try {
      const result = await saveProfileRequest(profile, t("error.generic"));
      if (result.demo) {
        setProfileDemo(true);
        return;
      }
      setProfile(result.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (cause) {
      setProfileError(cause instanceof TypeError ? t("error.network") : cause instanceof Error ? cause.message : t("error.generic"));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return alert(t("settings.passwordMismatch"));
    await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwords.new }),
    });
    setShowPasswordForm(false);
    setPasswords({ current: "", new: "", confirm: "" });
  }

  async function requestDeletion() {
    if (deleteConfirm !== "DELETE") return;
    await fetch("/api/account/delete", { method: "POST" });
    window.location.href = "/";
  }

  const TABS: { key: Tab; icon: typeof User; label: string }[] = [
    { key: "profile", icon: User, label: "settings.tabs.profile" },
    { key: "language", icon: Globe, label: "settings.tabs.language" },
    { key: "notifications", icon: Bell, label: "settings.tabs.notifications" },
    { key: "privacy", icon: Shield, label: "settings.tabs.privacy" },
  ];

  return (
    <div className="p-6" dir={dir}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("settings.title")}</h1>
      <div className="flex gap-6 flex-col md:flex-row">
        {/* Sidebar tabs */}
        <nav className="flex md:flex-col gap-1 md:w-48 flex-shrink-0">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-start
                ${tab === key ? "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <Icon className="w-4 h-4" />
              {t(label as any)}
            </button>
          ))}
          <div className="hidden md:flex flex-col gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link href="/onboarding" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <Sparkles className="w-4 h-4 text-brand-500" /> Onboarding Tour
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition text-start">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </form>
          </div>
        </nav>

        {/* Quick links */}
        <div className="md:hidden flex gap-2 mb-2">
          <Link href="/onboarding" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-100 transition">
            <Sparkles className="w-3.5 h-3.5" /> Onboarding Tour
          </Link>
          <form action="/api/auth/signout" method="POST" className="flex-1">
            <button type="submit" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 transition">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-xl">
          {tab === "profile" && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settings.profile.title")}</h2>
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("settings.profile.fullName")}</label>
                  <input type="text" value={profile.full_name || ""} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                {profileError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{profileError}</p>}
                {profileDemo && <p role="status" className="text-sm text-slate-600 dark:text-slate-400">{dir === "rtl" ? "الوضع التجريبي: لم يتم حفظ تغييرات الملف الشخصي." : "Demo mode: your profile changes have not been saved."}</p>}
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saved ? <><CheckCircle className="w-4 h-4" />{t("settings.profile.saved")}</> : saving ? t("common.saving") : t("common.save")}
                </button>
              </form>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{t("settings.profile.password")}</p>
                    <p className="text-xs text-slate-400">{t("settings.profile.passwordSub")}</p>
                  </div>
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="btn-secondary btn-sm">
                    <Lock className="w-3 h-3" />{t("settings.profile.changePassword")}
                  </button>
                </div>
                {showPasswordForm && (
                  <form onSubmit={changePassword} className="mt-4 space-y-3">
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder={t("settings.profile.newPassword")} required />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder={t("settings.profile.confirmPassword")} required />
                    <button type="submit" className="btn-primary w-full">{t("settings.profile.updatePassword")}</button>
                  </form>
                )}
              </div>
            </div>
          )}

          {tab === "language" && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settings.language.title")}</h2>
              <p className="text-sm text-slate-500">{t("settings.language.subtitle")}</p>
              <div className="grid grid-cols-2 gap-3">
                {[{ code: "en", name: "English", native: "English" }, { code: "ar", name: "Arabic", native: "العربية" }].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLocale(lang.code as "en" | "ar")}
                    className={`p-4 rounded-xl border-2 transition-all text-start ${locale === lang.code ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-slate-200 dark:border-slate-700 hover:border-brand-300"}`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{lang.native}</p>
                    <p className="text-xs text-slate-400">{lang.name}</p>
                    {locale === lang.code && <CheckCircle className="w-4 h-4 text-brand-500 mt-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settings.notifications.title")}</h2>
              {[
                "emailDeadlines", "emailAnnouncements", "emailWeeklyBrief", "pushDeadlines",
              ].map(key => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{t(`settings.notifications.${key}` as any)}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-9 h-5 bg-slate-200 peer-checked:bg-brand-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-brand-500 after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">{t("settings.privacy.title")}</h2>
                <button
                  onClick={() => fetch("/api/account/export").then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "tweenz-data.json"; a.click(); })}
                  className="btn-secondary w-full"
                >
                  <Download className="w-4 h-4" />{t("settings.privacy.exportData")}
                </button>
              </div>

              <div className="card border-red-200 dark:border-red-900 space-y-3">
                <h3 className="font-semibold text-red-600 dark:text-red-400">{t("settings.privacy.deleteAccount")}</h3>
                <p className="text-sm text-slate-500">{t("settings.privacy.deleteWarning")}</p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={t("settings.privacy.typeDelete")}
                />
                <button
                  onClick={requestDeletion}
                  disabled={deleteConfirm !== "DELETE"}
                  className="btn-danger w-full disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />{t("settings.privacy.deleteBtn")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
