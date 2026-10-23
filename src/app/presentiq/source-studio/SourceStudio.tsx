"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { composeProject, DeliveryProjectSchema, projectEvidence, reviewProject, type DeliveryProject, type Source } from "@/lib/presentiq/delivery/project";
import { useI18n } from "@/lib/presentiq/i18n/context";

const KEY = "pitchora-source-studio-v1";
function saveFile(data: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export function SourceStudio() {
  const { lang } = useI18n(); const ar = lang === "ar";
  const [title, setTitle] = useState(""); const [text, setText] = useState("");
  const [sources, setSources] = useState<Source[]>([]); const [project, setProject] = useState<DeliveryProject | null>(null);
  const [busy, setBusy] = useState(false); const [composing, setComposing] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [trace, setTrace] = useState<string[]>([]); const run = useRef(0);
  useEffect(() => () => { run.current++; }, []);
  const message = (en: string, arabic: string) => ar ? arabic : en;
  const issues = project ? reviewProject(project) : [];
  const evidence = project ? projectEvidence(project.sources) : [];
  function changed(next: DeliveryProject) { setProject(next); setNotice(""); }
  async function build() {
    const id = ++run.current; setBusy(true); setComposing(true); setError(""); setTrace([]);
    try {
      const all = [...sources, ...(text.trim() ? [{ id: "pasted", name: message("Pasted source", "النص المضاف"), text }] : [])];
      const { SourceSchema } = await import("@/lib/presentiq/delivery/project");
      if (id !== run.current) return;
      all.forEach(source => SourceSchema.parse(source));
      setTrace([message("1. Source reader: validated supplied text", "١. تم فحص النصوص المضافة")]);
      await new Promise(r => setTimeout(r, 0)); if (id !== run.current) return;
      const result = composeProject(title, ar ? "ar" : "en", all);
      setTrace(t => [...t, message("2. Composer: created source-linked excerpts", "٢. تم بناء مشاهد مرتبطة بمصادرها")]);
      await new Promise(r => setTimeout(r, 0)); if (id !== run.current) return;
      const checks = reviewProject(result);
      setTrace(t => [...t, message(`3. Reviewer: ${checks.length} author reviews pending`, `٣. المراجعة: ${checks.length} بنود تنتظر مراجعتك`)]);
      if (id !== run.current) return;
      changed(result); setNotice(message("Draft created. These are deterministic source-processing steps, not LLM agents. Review every scene before export.", "تم إعداد المسودة بخطوات معالجة محددة، وليست وكلاء ذكاء اصطناعي لغوي. راجع كل مشهد قبل التصدير."));
    } catch (e) { if (id === run.current) setError(e instanceof Error && !e.message.startsWith("[") ? e.message : message("Check the title, source text and project limits.", "راجع العنوان والمصادر وحدود المشروع.")); }
    finally { if (id === run.current) { setBusy(false); setComposing(false); } }
  }
  async function addFiles(files: FileList | null) {
    if (!files || busy) return; const id = ++run.current; setError(""); setBusy(true);
    try {
      const added: Source[] = [];
      if (sources.length + files.length + (text.trim() ? 1 : 0) > 10) throw new Error("Maximum 10 sources");
      let characters = sources.reduce((n, source) => n + source.text.length, text.length);
      const { importSource } = await import("@/lib/presentiq/delivery/import-source");
      for (const file of Array.from(files)) { const source = await importSource(file); if (id !== run.current) return; characters += source.text.length; if (characters > 200_000) throw new Error("Source character limit exceeded"); added.push(source); }
      setSources(old => [...old, ...added]); setProject(null);
    } catch (e) { if (id === run.current) setError((e as Error).message); } finally { if (id === run.current) setBusy(false); }
  }
  async function exportFile(kind: "pptx" | "html" | "bundle") {
    if (!project || busy) return; setBusy(true); setError("");
    try {
      const exports = await import("@/lib/presentiq/delivery/exports");
      if (kind === "html") saveFile(exports.deliveryHtml(project), "text/html", "pitchora-presentation.html");
      else {
        const pptx = await exports.deliveryPptx(project);
        if (kind === "pptx") saveFile(pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pitchora-presentation.pptx");
        else {
          const JSZip = (await import("jszip")).default; const zip = new JSZip();
          const res = await fetch("/pitchora/render_video.py"); if (!res.ok) throw new Error("Video renderer download failed");
          const script = await res.text(); if (!script.startsWith("#!/usr/bin/env python3")) throw new Error("Invalid renderer response");
          zip.file("deck.pptx", pptx); zip.file("project.json", JSON.stringify(project, null, 2));
          zip.file("timeline.json", JSON.stringify(exports.deliveryTimeline(project), null, 2)); zip.file("render_video.py", script);
          zip.file("README.txt", "Pitchora local rendering package, NOT an exported video.\nRequires Python 3, LibreOffice, Poppler (pdftoppm), FFmpeg and ffprobe installed from official sources.\nRun: python3 render_video.py\nOptional original narration: python3 render_video.py --audio narration.wav\nAdd --fit-audio to proportionally fit manual cues to the measured audio duration; this is NOT word alignment.\nFor exact cues, edit timeline.json and keep total duration equal to audio.\nNo music or narration is fabricated. Inspect the complete output.mp4 with sound, Arabic shaping, citations and mobile readability before publication.\nProject JSON contains your source text; share only intentionally.\n");
          saveFile(await zip.generateAsync({ type: "arraybuffer" }), "application/zip", "pitchora-motion-project.zip");
        }
      }
      setNotice(message("File prepared. Inspect the exported result before sharing; a video package is not an MP4.", "تم تجهيز الملف. راجع النتيجة قبل المشاركة؛ حزمة مشروع الفيديو ليست ملف MP4."));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function restore(raw: string) {
    const parsed = DeliveryProjectSchema.parse(JSON.parse(raw)); setError(""); setTrace([]); changed(parsed); setTitle(parsed.title); setSources(parsed.sources.filter(s => s.id !== "pasted")); setText(parsed.sources.find(s => s.id === "pasted")?.text ?? "");
  }
  const button = "pq-btn pq-btn-liquid disabled:opacity-50";
  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 py-6">
    <header className="relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-indigo-500/10 p-6 sm:p-10">
      <Image src="/pitchora/brand-3d.webp" alt="" width={240} height={240} className="hidden xl:block float-right ms-6" />
      <p className="text-sm uppercase tracking-widest text-indigo-300">Pitchora · Source Studio</p>
      <h1 className="my-4 text-3xl sm:text-5xl font-semibold">{message("Your sources. A story you can defend.", "مصادرك. عرض تقدر تشرح أساسه.")}</h1>
      <p className="max-w-3xl text-lg">{message("Build editable slides and a video timeline from your actual text. No invented statistics, no paid model calls, no automatic publishing.", "حوّل نصوصك الفعلية إلى شرائح قابلة للتعديل وخط زمني للفيديو. دون أرقام مختلقة أو نموذج مدفوع أو نشر تلقائي.")}</p>
      <p className="mt-4 text-sm opacity-80">{message("Local single-user authoring, separate from the authenticated team workspace. Sources stay in this browser tab unless you explicitly save or export. This is not cloud sync.", "تحرير محلي لمستخدم واحد، منفصل عن مساحة الفريق المسجلة. تبقى المصادر في هذه الصفحة إلا عند الحفظ أو التصدير باختيارك. ليست مزامنة سحابية.")}</p>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-400 p-4">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-indigo-300 p-4">{notice}</p>}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
      <section className="min-w-0 rounded-2xl border border-indigo-400/30 p-5 space-y-4" aria-label="Source intake">
        <h2 className="text-xl font-semibold">{message("1. Brief & sources", "١. الهدف والمصادر")}</h2>
        <label className="block">{message("Presentation title", "عنوان العرض")}<input className="pq-input w-full mt-1" value={title} maxLength={200} disabled={busy} onChange={e => { setTitle(e.target.value); setProject(null); }} /></label>
        <label className="block">{message("Paste your source text", "أضف نص المصدر")}<textarea className="pq-input w-full min-h-48 mt-1" value={text} maxLength={100000} disabled={busy} onChange={e => { setText(e.target.value); setProject(null); }} /></label>
        <label className="block text-sm">{message("Add PDF, TXT, MD or CSV sources", "إضافة مصادر PDF أو TXT أو MD أو CSV")}<input className="block w-full min-w-0 max-w-full" type="file" multiple accept=".pdf,.txt,.md,.csv" disabled={busy} onChange={e => void addFiles(e.target.files)} /></label>
        <p className="text-xs opacity-80">{message("CSV remains source text; charts and computed statistics are not invented. Up to 10 sources, 200,000 total characters; first 12 passages form the editable draft.", "CSV يُحفظ كنص مصدر دون اختراع رسوم أو حسابات. حتى ١٠ مصادر و٢٠٠ ألف حرف؛ أول ١٢ مقطعًا تشكّل المسودة القابلة للتعديل.")}</p>
        <ul>{sources.map(s => <li key={s.id} className="flex justify-between gap-2 text-sm break-all">{s.name}<button disabled={busy} onClick={() => { setSources(old => old.filter(x => x.id !== s.id)); setProject(null); }}>{message("Remove", "إزالة")}</button></li>)}</ul>
        <button className={button} disabled={busy || title.trim().length < 2 || (!text.trim() && !sources.length)} onClick={() => void build()}>{message("Compose source-led draft", "بناء مسودة من المصادر")}</button>
        {composing && <button className={button} onClick={() => { run.current++; setBusy(false); setComposing(false); setTrace([]); }}>{message("Cancel composition", "إلغاء البناء")}</button>}
        <ol aria-live="polite" className="space-y-2 text-sm">{trace.map(t => <li key={t}>{t}</li>)}</ol>
        <hr className="opacity-20" />
        <button className={button} disabled={busy} onClick={() => { try { const raw = localStorage.getItem(KEY); if (!raw) throw new Error("No local saved project"); restore(raw); } catch { setError(message("No valid local project could be restored.", "تعذّر استرجاع مشروع محلي صالح.")); } }}>{message("Restore local save", "استرجاع الحفظ المحلي")}</button>
        <label className="block text-sm">{message("Restore project JSON", "استرجاع ملف المشروع JSON")}<input className="block w-full min-w-0 max-w-full" type="file" accept=".json" disabled={busy} onChange={async e => {
          const file = e.target.files?.[0]; if (!file || busy) return;
          const id = ++run.current; setBusy(true); setError("");
          try { if (file.size > 2_000_000) throw new Error(); const raw = await file.text(); if (id === run.current) restore(raw); }
          catch { if (id === run.current) setError(message("Invalid project file. Current work was preserved.", "ملف مشروع غير صالح. لم يتغيّر عملك الحالي.")); }
          finally { if (id === run.current) setBusy(false); }
        }} /></label>
      </section>
      <section className="min-w-0 space-y-4" aria-label="Storyboard review">
        <h2 className="text-xl font-semibold">{message("2. Storyboard & human review", "٢. المشاهد والمراجعة البشرية")}</h2>
        {!project && <div className="rounded-2xl border border-dashed border-indigo-400/40 p-12 text-center">{message("Your real content will appear here, with its source beside every scene.", "هنا يظهر محتواك الفعلي، مع مصدر كل مشهد.")}</div>}
        {project?.scenes.map((scene, i) => {
          const ref = evidence.find(e => e.id === scene.evidenceId); const source = project.sources.find(s => s.id === ref?.source_file_id);
          const edit = (patch: Partial<typeof scene>) => changed({ ...project, scenes: project.scenes.map((s, j) => j === i ? { ...s, ...patch, reviewed: false } : s) });
          return <article key={i} className="rounded-2xl border border-indigo-400/30 p-5 space-y-3" dir={project.language === "ar" ? "rtl" : "ltr"}>
            <p className="text-xs text-indigo-300">{i + 1} / {project.scenes.length} · {source?.name} · {ref?.source_reference?.page ? `p.${ref.source_reference.page} · ` : ""}{ref?.source_reference?.span?.join("–")}</p>
            <label className="block text-sm">{message("Scene headline", "عنوان المشهد")}<input className="pq-input w-full text-xl mt-1" value={scene.title} disabled={busy} maxLength={160} onChange={e => edit({ title: e.target.value })} /></label>
            <label className="block text-sm">{message("Visible content", "المحتوى المرئي")}<textarea className="pq-input w-full min-h-28 mt-1" value={scene.text} disabled={busy} maxLength={600} onChange={e => edit({ text: e.target.value })} /></label>
            <details className="text-sm"><summary>{message("Inspect original source passage", "عرض نص المصدر الأصلي")}</summary><p className="mt-2 whitespace-pre-wrap">{ref?.claim}</p></details>
            <div className="flex flex-wrap gap-4 items-center"><label>{message("Seconds", "ثوانٍ")} <input aria-label={`Scene ${i + 1} seconds`} type="number" className="pq-input w-24" min={2} max={120} value={scene.seconds} disabled={busy} onChange={e => edit({ seconds: Number(e.target.value) })} /></label>
              <label className="text-sm"><input type="checkbox" checked={scene.reviewed} disabled={busy} onChange={e => changed({ ...project, scenes: project.scenes.map((s, j) => j === i ? { ...s, reviewed: e.target.checked } : s) })} /> {message("I checked the source, wording, units and meaning", "راجعت المصدر والصياغة والوحدات والمعنى")}</label></div>
          </article>;
        })}
      </section>
    </div>
    {project && <section className="min-w-0 rounded-2xl border border-indigo-300/40 p-6 space-y-4">
      <h2 className="text-xl font-semibold">{message("3. Save & deliver", "٣. الحفظ والتسليم")}</h2>
      <p>{message("Editable PPTX · standalone HTML with browser PDF printing · editable JSON · local MP4 rendering package. No automatic narration, music or word alignment.", "PPTX قابل للتعديل · HTML مستقل مع الطباعة إلى PDF · JSON قابل للتحرير · حزمة تصدير MP4 محليًا. دون ادعاء توليد تعليق صوتي أو موسيقى أو مزامنة كلمات.")}</p>
      <p role="status">{issues.length ? `${issues.length} ${message("review items remain", "بنود مراجعة متبقية")}` : message("Checks passed; author review recorded, not independent certification.", "اجتازت الفحوص وسُجّلت مراجعتك، وليست شهادة اعتماد مستقلة.")}</p>
      {issues.length > 0 && <details><summary>{message("Show checks", "عرض الفحوص")}</summary><ul>{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={busy} onClick={() => { try { DeliveryProjectSchema.parse(project); localStorage.setItem(KEY, JSON.stringify(project)); setNotice(message("Saved on this browser only. Download JSON as a backup; browser clearing removes this save.", "تم الحفظ في هذا المتصفح فقط. نزّل JSON احتياطيًا؛ مسح بيانات المتصفح يزيل الحفظ.")); } catch { setError("Local save unavailable or project invalid. Download JSON instead."); } }}>{message("Save locally", "حفظ محلي")}</button>
        <button className={button} disabled={busy} onClick={() => saveFile(JSON.stringify(project, null, 2), "application/json", "pitchora-project.json")}>JSON</button>
        <button className={button} disabled={busy || issues.length > 0} onClick={() => void exportFile("pptx")}>PPTX</button>
        <button className={button} disabled={busy || issues.length > 0} onClick={() => void exportFile("html")}>HTML / PDF</button>
        <button className={button} disabled={busy || issues.length > 0} onClick={() => void exportFile("bundle")}>{message("Video render package", "حزمة تصدير الفيديو")}</button>
      </div>
    </section>}
  </div>;
}
