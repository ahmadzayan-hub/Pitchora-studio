"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import {
  labelFor,
  listFor,
  loadPreferred,
  savePreferred,
  type VoiceLocale
} from "@/lib/voice-locales";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface Props {
  /** Called with each transcribed chunk. The second arg is true when final. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /**
   * Optional: when smart-submit is enabled and the user has a final
   * transcript followed by SILENCE_HOLD_MS of silence, this fires. The
   * parent typically uses it to auto-generate the prompt.
   */
  onAutoSubmit?: () => void;
  /**
   * Optional: called when voice fails entirely so the parent can focus the
   * textarea for typing. Wired by the workspace.
   */
  onTypeInstead?: () => void;
  className?: string;
}

const SILENCE_THRESHOLD = 0.04;     // RMS below this counts as silence
const SILENCE_HOLD_MS  = 2500;      // need this much continuous silence
const SMART_SUBMIT_KEY = "po_smart_submit_v1";

// If the recogniser captures audio but produces zero transcripts for this
// long, fall back to en-US once (most universally supported STT language)
// and surface a "Type instead" escape hatch.
const NO_RESULT_FALLBACK_MS = 8000;
const FALLBACK_LANG = "en-US";

type Status = "idle" | "requesting" | "listening" | "denied" | "error" | "unsupported";

/**
 * Professional voice input.
 *
 * Why this rewrite — the previous version had three concrete bugs:
 *   1. It never explicitly requested microphone permission via getUserMedia,
 *      so on some browsers `recognition.start()` silently failed before any
 *      prompt appeared.
 *   2. It only forwarded final transcripts. With no interim feedback, users
 *      couldn't tell whether the recogniser was hearing them.
 *   3. There was no audio-level meter, so a muted mic looked the same as a
 *      working one until 30 s passed with no result.
 *
 * This version:
 *   - Requests mic permission up front via `getUserMedia` (with a clear
 *     error path for "denied" / "no device").
 *   - Streams interim transcripts to the parent so the textarea fills as
 *     the user speaks (with a delete-and-replace strategy to avoid double
 *     insertion when a chunk is finalised).
 *   - Renders a live RMS audio-level bar from a Web Audio analyser node, so
 *     the user sees their voice is actually being captured.
 *   - Auto-restarts only on benign auto-end events (Chrome's silence timer)
 *     and gives up cleanly on hard failures.
 */
export default function VoiceInput({ onTranscript, onAutoSubmit, onTypeInstead, className }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);              // 0..1 audio RMS
  const [voiceLocale, setVoiceLocale] = useState<VoiceLocale | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [smartSubmit, setSmartSubmit] = useState(false);
  // What the recogniser is hearing *right now* — shown so the user has
  // immediate proof that speech is being captured. Cleared on stop / on the
  // next interim chunk.
  const [liveText, setLiveText] = useState<string>("");
  // True once at least one final transcript has arrived in this session;
  // suppresses the "no speech detected" hint after that.
  const [gotResult, setGotResult] = useState<boolean>(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const userStoppedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web-audio chain for the level meter
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Track last interim transcript so we can replace, not duplicate
  const lastInterimRef = useRef<string>("");
  // Smart-submit silence tracker
  const lastVoiceAtRef = useRef<number>(0);
  const hasFinalRef = useRef<boolean>(false);
  const autoSubmittedRef = useRef<boolean>(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  // Stuck-recogniser tracker: if audio is being captured but no transcript
  // arrives, switch to a universal fallback language and remember we tried.
  const audioStartedAtRef = useRef<number>(0);
  const audioSeenRef = useRef<boolean>(false);
  const fallbackTriedRef = useRef<boolean>(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    setVoiceLocale(loadPreferred(locale));
  }, [locale]);

  // Restore smart-submit preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSmartSubmit(window.localStorage.getItem(SMART_SUBMIT_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  // Detect browser support once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) setStatus("unsupported");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  function stopAll() {
    userStoppedRef.current = true;
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* ignore */ }
      recRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tk) => tk.stop());
      streamRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startedAtRef.current = null;
    setLevel(0);
  }

  async function requestMicAndStart() {
    setErrorDetail(null);
    setStatus("requesting");

    // 1. Explicit mic permission so the browser shows its prompt now, not
    //    silently inside SpeechRecognition.start(). Bonus: the resulting
    //    MediaStream powers the level meter.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (e) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setStatus("denied");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setStatus("error");
        setErrorDetail(t("voice.no_device"));
      } else {
        setStatus("error");
        setErrorDetail(err?.message ?? String(e));
      }
      return;
    }
    streamRef.current = stream;

    // 2. Wire up the level meter
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 3));

          // Smart-submit: refresh "last voice" timestamp whenever the user is
          // audibly speaking. When we have a final transcript AND continuous
          // silence for SILENCE_HOLD_MS, fire onAutoSubmit exactly once.
          const now = Date.now();
          if (rms > SILENCE_THRESHOLD) {
            lastVoiceAtRef.current = now;
            // Mark that we've seen the user actually speak — this rules out
            // "user is silent" as the cause when no transcript arrives.
            audioSeenRef.current = true;
          }
          const silentFor = lastVoiceAtRef.current ? now - lastVoiceAtRef.current : 0;
          if (
            !autoSubmittedRef.current &&
            hasFinalRef.current &&
            silentFor >= SILENCE_HOLD_MS &&
            onAutoSubmitRef.current
          ) {
            autoSubmittedRef.current = true;
            stop();
            setTimeout(() => onAutoSubmitRef.current?.(), 50);
          }

          // Stuck recogniser: audible speech detected, but no transcript for
          // NO_RESULT_FALLBACK_MS. Try once with FALLBACK_LANG (en-US),
          // which is the most universally supported STT locale. If that
          // also fails the user still has the "Type instead" button.
          const sinceStart = audioStartedAtRef.current ? now - audioStartedAtRef.current : 0;
          if (
            !hasFinalRef.current &&
            audioSeenRef.current &&
            sinceStart >= NO_RESULT_FALLBACK_MS &&
            !fallbackTriedRef.current
          ) {
            fallbackTriedRef.current = true;
            setStuck(true);
            const r = recRef.current;
            if (r) {
              try {
                userStoppedRef.current = false;
                r.lang = FALLBACK_LANG;
                try { r.stop(); } catch { /* will restart in onend */ }
              } catch { /* ignore */ }
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      // Level meter is decoration; ignore failures
    }

    // 3. Start the actual SpeechRecognition.
    //
    // Mobile browsers (Samsung Internet, Chrome on Android) consistently
    // misbehave when continuous=true: they fire onstart, capture audio,
    // but never emit results. The reliable shape on mobile is single-shot
    // recognition with onend → restart, which we transparently emulate.
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    const isMobile =
      typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod|mobile|silk/i.test(navigator.userAgent);
    const rec = new Ctor();
    rec.continuous = !isMobile;        // single-shot on mobile, continuous on desktop
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = voiceLocale?.code ?? (locale === "ar" ? "ar-EG" : "en-US");

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) finalText += txt;
        else interim += txt;
      }
      // Always show the live transcript pill — this is the user's confirmation
      // that the recogniser is hearing them, even before a final arrives.
      setLiveText(finalText || interim);
      if (finalText) {
        // Final overrides any pending interim → tell parent to replace+commit
        if (lastInterimRef.current) {
          // First, undo the interim (parent saw it as "interim:true")
          onTranscript(lastInterimRef.current, false /* not final */);
          lastInterimRef.current = "";
        }
        onTranscript(finalText, true);
        hasFinalRef.current = true;
        setGotResult(true);
        lastVoiceAtRef.current = Date.now();
        // Fade the pill briefly so finals feel "committed"
        setTimeout(() => setLiveText(""), 1200);
      } else if (interim) {
        lastInterimRef.current = interim;
        onTranscript(interim, false);
      }
    };

    rec.onerror = (e: any) => {
      // Recoverable on mobile during pauses — keep going unless the user stopped
      if (
        !userStoppedRef.current &&
        (e.error === "no-speech" || e.error === "audio-capture" || e.error === "aborted")
      ) {
        return;
      }
      setStatus("error");
      setErrorDetail(t("voice.error", { detail: e.error }));
      stopAll();
    };

    rec.onend = () => {
      if (!userStoppedRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* ignore */
        }
      }
      setStatus("idle");
      stopAll();
    };

    recRef.current = rec;
    userStoppedRef.current = false;
    hasFinalRef.current = false;
    autoSubmittedRef.current = false;
    lastVoiceAtRef.current = Date.now();
    audioStartedAtRef.current = Date.now();
    audioSeenRef.current = false;
    fallbackTriedRef.current = false;
    setStuck(false);
    // Reset diagnostic surface so an old transcript / state doesn't leak
    // into a fresh listening session.
    setLiveText("");
    setGotResult(false);

    try {
      rec.start();
      setStatus("listening");
      startedAtRef.current = Date.now();
      setElapsed(0);
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
    } catch (e) {
      setStatus("error");
      setErrorDetail(String(e));
      stopAll();
    }
  }

  function stop() {
    setStatus("idle");
    setLiveText("");
    stopAll();
  }

  function toggle() {
    if (status === "listening" || status === "requesting") stop();
    else void requestMicAndStart();
  }

  function pickLocale(v: VoiceLocale) {
    setVoiceLocale(v);
    savePreferred(locale, v);
    setPickerOpen(false);
  }

  function toggleSmartSubmit() {
    const next = !smartSubmit;
    setSmartSubmit(next);
    try { window.localStorage.setItem(SMART_SUBMIT_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }

  if (status === "unsupported") {
    return (
      <span className={`text-xs text-slate-500 ${className ?? ""}`} title={t("voice.unsupported")}>
        🎤 —
      </span>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const list = listFor(locale);
  const listening = status === "listening";

  // The auto-submit trigger only fires when the user has opted in.
  const effectiveAutoSubmit = onAutoSubmit && smartSubmit ? onAutoSubmit : undefined;
  // Re-bind ref on every render so the always-current callback is reachable.
  onAutoSubmitRef.current = effectiveAutoSubmit;

  // Diagnostic hint shown when audio is being captured but no transcript has
  // arrived for ≥ 5 seconds. Helps the user realise their dialect setting
  // is wrong, the language is mismatched, or the mic is picking up silence.
  const showNoSpeechHint =
    listening &&
    !gotResult &&
    !liveText &&
    elapsed >= 5;

  return (
    <div className={`relative flex items-center gap-1.5 ${className ?? ""}`}>
      {/* Live-transcript popover. floats above the button row when active so
          the user has visible proof the recogniser is hearing them. When the
          recogniser gets stuck (audio detected, no transcript), we surface a
          "Type instead" escape hatch that focuses the textarea. */}
      {(listening && (liveText || showNoSpeechHint || stuck)) && (
        <div
          className="absolute bottom-full end-0 mb-2 max-w-[min(520px,calc(100vw-2rem))] min-w-[220px] rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 z-30"
          aria-live="polite"
        >
          {liveText ? (
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-100 whitespace-pre-wrap">
              {liveText}
            </p>
          ) : (
            <>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {stuck
                  ? t("voice.fallback_tried")
                  : t("voice.no_speech_hint", { dialect: voiceLocale ? labelFor(voiceLocale, locale) : "—" })}
              </p>
              {onTypeInstead && (
                <button
                  type="button"
                  onClick={() => { stop(); onTypeInstead(); }}
                  className="mt-2 btn-ghost text-[11px] px-2 py-1 border border-slate-300 dark:border-slate-700"
                >
                  ⌨️ {t("voice.type_instead")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {onAutoSubmit && (
        <button
          type="button"
          onClick={toggleSmartSubmit}
          aria-pressed={smartSubmit}
          aria-label={t("voice.smart_submit")}
          title={t(smartSubmit ? "voice.smart_submit_on" : "voice.smart_submit_off")}
          className={
            "inline-flex items-center justify-center w-9 h-9 rounded-full transition text-base " +
            (smartSubmit
              ? "bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700"
              : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-300 dark:border-slate-700 hover:border-emerald-300")
          }
        >
          <span aria-hidden="true">⚡</span>
        </button>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label={t("voice.dialect")}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          disabled={listening}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white hover:border-brand-400 transition text-base leading-none disabled:opacity-60"
          title={voiceLocale ? labelFor(voiceLocale, locale) : t("voice.dialect")}
        >
          <span aria-hidden="true">{voiceLocale?.flag ?? "🌐"}</span>
        </button>
        {pickerOpen && (
          <ul
            role="listbox"
            aria-label={t("voice.dialect")}
            className="absolute bottom-full mb-2 end-0 z-40 max-h-72 w-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
          >
            {list.map((v) => {
              const active = voiceLocale?.code === v.code;
              return (
                <li key={v.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pickLocale(v)}
                    className={
                      "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-100 " +
                      (active ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-700")
                    }
                  >
                    <span aria-hidden="true" className="text-base">{v.flag}</span>
                    <span className="truncate flex-1 text-start">{labelFor(v, locale)}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{v.code}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? t("voice.stop") : t("voice.start")}
        aria-pressed={listening}
        className={
          "relative inline-flex items-center justify-center w-10 h-10 rounded-full transition shadow-sm " +
          (listening
            ? "bg-rose-600 text-white shadow-rose-300/50"
            : "bg-white border border-slate-300 text-slate-700 hover:border-brand-400 hover:text-brand-700")
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {listening ? (
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </>
          )}
        </svg>
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full animate-ping bg-rose-400/40" />
            {/* Live audio-level ring — scales with RMS */}
            <span
              className="absolute inset-0 rounded-full bg-rose-300/30"
              style={{ transform: `scale(${1 + level * 0.45})`, transition: "transform 80ms linear" }}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {status === "requesting" && (
        <span className="text-xs text-slate-500" aria-live="polite">{t("voice.requesting")}</span>
      )}
      {listening && (
        <span className="flex items-center gap-2 text-xs text-rose-600 font-medium" aria-live="polite">
          <span className="tabular-nums">● {mm}:{ss}</span>
          {/* 5-bar mini level meter */}
          <span className="inline-flex items-end gap-[2px] h-3.5" aria-hidden="true">
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((threshold, i) => (
              <span
                key={i}
                className={
                  "w-[3px] rounded-sm transition-colors " +
                  (level >= threshold ? "bg-rose-600" : "bg-rose-200")
                }
                style={{ height: `${30 + i * 14}%` }}
              />
            ))}
          </span>
          <span>{t("voice.listening")}</span>
        </span>
      )}
      {status === "denied" && (
        <span className="text-xs text-rose-700">{t("voice.denied")}</span>
      )}
      {status === "error" && errorDetail && (
        <span className="text-xs text-rose-700">{errorDetail}</span>
      )}
    </div>
  );
}
