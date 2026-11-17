"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Square, Play, Pause, Sparkles, Mail, Download,
  RefreshCw, BookOpen, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  FileText, Users, Send, Copy, Check,
} from "lucide-react";
import { format } from "date-fns";

interface TranscriptLine {
  timestamp: string;
  text: string;
  isFinal: boolean;
}

interface Course { id: string; name: string; code: string; instructor: string; }

declare global {
  var SpeechRecognition: any;
}

const DEMO_SUMMARY = `## Lecture Summary — Porter's Five Forces Analysis

**Key Concepts Covered:**
1. **Competitive Rivalry** — Intensity of competition among existing firms. In UAE telecoms (Etisalat vs. du), rivalry is high due to market saturation and price sensitivity.
2. **Threat of New Entrants** — Barriers to entry in UAE aviation are very high (capital requirements, regulatory approvals, slot availability at DXB).
3. **Bargaining Power of Suppliers** — Boeing and Airbus duopoly gives suppliers strong leverage over airlines. Emirates manages this via long-term contracts and fleet diversity.
4. **Bargaining Power of Buyers** — In B2C markets, individual buyers have low power; corporate clients (B2B) can negotiate volume discounts.
5. **Threat of Substitutes** — UAE rail (Etihad Rail) is a moderate substitute for short-haul flights; videoconferencing reduced business travel demand post-COVID.

**Action Items:**
- Apply the framework to your SWOT Analysis case company
- Compare UAE telecoms vs. aviation sector forces
- Review Chapter 3 pages 87–102 before next session
- Complete the Porter's Five Forces worksheet by Friday

**Instructor Notes:**
- Mid-term will include one case requiring full Five Forces analysis
- Bring a UAE company example to next class for discussion`;

const DEMO_TRANSCRIPT: TranscriptLine[] = [
  { timestamp: "00:00:12", text: "Welcome everyone. Today we're covering Porter's Five Forces framework, which is one of the most widely used strategic analysis tools in business.", isFinal: true },
  { timestamp: "00:01:05", text: "The framework was developed by Michael Porter at Harvard Business School in 1979. Let me start with the first force: competitive rivalry.", isFinal: true },
  { timestamp: "00:03:22", text: "In the UAE telecoms market, we have essentially a duopoly — Etisalat and du. High rivalry means thin margins, which forces both companies into service differentiation.", isFinal: true },
  { timestamp: "00:06:14", text: "Now let's look at threat of new entrants. Think about what it takes to enter the aviation industry. You need aircraft, which cost hundreds of millions. You need landing slots, regulatory approvals, trained pilots.", isFinal: true },
  { timestamp: "00:09:33", text: "Supplier power — this is interesting for aviation. Boeing and Airbus together control roughly 99% of large commercial aircraft production. That's extraordinary supplier leverage.", isFinal: true },
  { timestamp: "00:13:45", text: "Buyer power varies dramatically by segment. Individual consumers booking flights have very little power. But a large corporate travel account buying 10,000 flights per year? They can negotiate significantly.", isFinal: true },
  { timestamp: "00:17:28", text: "Finally, substitutes. Videoconferencing — Zoom, Teams — has genuinely reduced demand for short-haul business travel. That's a real substitute that emerged and changed the industry.", isFinal: true },
  { timestamp: "00:21:00", text: "For your SWOT Analysis assignment, I want you to apply all five forces to your chosen company. The mid-term will definitely include a case requiring this full analysis.", isFinal: true },
];

const DEMO_ATTENDEES = [
  { id: "u-002", name: "Khalid Al-Rashidi", email: "khalid@tweenz.ae" },
  { id: "u-003", name: "Layla Hassan", email: "layla@tweenz.ae" },
  { id: "u-006", name: "Mohammed Al-Farsi", email: "m.alfarsi@tweenz.ae" },
  { id: "u-007", name: "Nora Al-Suwaidi", email: "nora@tweenz.ae" },
];

export default function LecturePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"setup" | "recording" | "done">("setup");
  const [summary, setSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(DEMO_ATTENDEES.map(a => a.id));
  const [copied, setCopied] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const demoIdxRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/courses").then(r => r.ok ? r.json() : []).then(d => {
      setCourses(d);
      if (d.length) setSelectedCourse(d[0].id);
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, currentLine]);

  const startTimer = () => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const startDemoPlayback = () => {
    setDemoPlaying(true);
    demoIdxRef.current = 0;
    const play = () => {
      if (demoIdxRef.current >= DEMO_TRANSCRIPT.length) {
        setDemoPlaying(false);
        return;
      }
      const line = DEMO_TRANSCRIPT[demoIdxRef.current];
      setCurrentLine(line.text);
      setTimeout(() => {
        setTranscript(prev => [...prev, line]);
        setCurrentLine("");
        demoIdxRef.current++;
        demoIntervalRef.current = setTimeout(play, 2000 + Math.random() * 1500);
      }, 1500);
    };
    demoIntervalRef.current = setTimeout(play, 800);
  };

  const startRecording = useCallback(() => {
    if (!lectureTitle.trim()) return;
    setPhase("recording");
    setElapsed(0);
    setTranscript([]);
    startTimer();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      recognitionRef.current = rec;
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const ts = formatTime(elapsed);
            setTranscript(prev => [...prev, { timestamp: ts, text: e.results[i][0].transcript.trim(), isFinal: true }]);
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        setCurrentLine(interim);
      };
      rec.onerror = () => startDemoPlayback();
      rec.start();
    } else {
      startDemoPlayback();
    }
    setRecording(true);
    setPaused(false);
  }, [lectureTitle, elapsed]);

  const pauseRecording = () => {
    setPaused(true);
    stopTimer();
    if (recognitionRef.current) recognitionRef.current.stop();
    if (demoIntervalRef.current) clearTimeout(demoIntervalRef.current);
  };

  const resumeRecording = () => {
    setPaused(false);
    startTimer();
    if (recognitionRef.current) recognitionRef.current.start();
    else startDemoPlayback();
  };

  const stopRecording = async () => {
    setRecording(false);
    setPaused(false);
    stopTimer();
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (demoIntervalRef.current) clearTimeout(demoIntervalRef.current);
    setCurrentLine("");
    setPhase("done");
    setGeneratingSummary(true);
    await new Promise(r => setTimeout(r, 1800));
    setSummary(DEMO_SUMMARY);
    setGeneratingSummary(false);
  };

  const sendEmails = async () => {
    setEmailStatus("sending");
    await fetch("/api/lecture/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lectureTitle,
        courseId: selectedCourse,
        summary,
        transcript: transcript.map(l => `[${l.timestamp}] ${l.text}`).join("\n"),
        attendeeIds: selectedAttendees,
      }),
    });
    await new Promise(r => setTimeout(r, 1200));
    setEmailStatus("sent");
  };

  const copyTranscript = () => {
    const text = transcript.map(l => `[${l.timestamp}] ${l.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranscript = () => {
    const course = courses.find(c => c.id === selectedCourse);
    const header = `LECTURE TRANSCRIPT\nCourse: ${course?.name ?? ""} (${course?.code ?? ""})\nTitle: ${lectureTitle}\nDate: ${format(new Date(), "PPP")}\nDuration: ${formatTime(elapsed)}\n\n${"─".repeat(60)}\n\n`;
    const body = transcript.map(l => `[${l.timestamp}] ${l.text}`).join("\n\n");
    const full = header + body + (summary ? `\n\n${"─".repeat(60)}\n\nAI SUMMARY\n\n${summary}` : "");
    const blob = new Blob([full], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `lecture-${lectureTitle.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const course = courses.find(c => c.id === selectedCourse);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic className="w-7 h-7 text-red-500" />
            Lecture Transcription
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time transcription • AI summary • Auto-email to class</p>
        </div>
      </div>

      {phase === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Setup form */}
          <div className="lg:col-span-2 card space-y-5">
            <h2 className="font-semibold text-slate-900 dark:text-white text-lg">Start New Lecture</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course</label>
              <select
                className="input w-full"
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Lecture Title</label>
              <input
                className="input w-full"
                placeholder="e.g. Porter's Five Forces — Session 7"
                value={lectureTitle}
                onChange={e => setLectureTitle(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Mic className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">How it works</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>Click <strong>Start Recording</strong> — your microphone will activate</li>
                  <li>Speak naturally — transcript appears in real-time</li>
                  <li>Stop when done — AI generates a structured summary</li>
                  <li>Review and send transcript + summary to classmates by email</li>
                </ol>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-500">Demo mode: uses simulated transcript if mic is unavailable</p>
              </div>
            </div>
            <button
              onClick={startRecording}
              disabled={!lectureTitle.trim() || !selectedCourse}
              className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </button>
          </div>

          {/* Tips */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Tips for Best Results</h3>
            {[
              { icon: "🎤", tip: "Speak clearly at a moderate pace" },
              { icon: "🔇", tip: "Minimize background noise" },
              { icon: "📍", tip: "Stay close to the microphone" },
              { icon: "⏸️", tip: "Pause recording during breaks" },
              { icon: "✏️", tip: "Add lecture title for better AI context" },
              { icon: "📧", tip: "Select classmates before stopping to auto-email" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(phase === "recording" || phase === "done") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Recording controls */}
            <div className={`card flex items-center gap-4 ${recording && !paused ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20" : "border-slate-200 dark:border-slate-700"}`}>
              {recording && !paused && (
                <span className="flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute h-3 w-3 rounded-full bg-red-400 opacity-75" />
                  <span className="relative h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {phase === "done" ? "Recording complete" : paused ? "Paused" : "Recording…"}
                </p>
                <p className="text-xs text-slate-500">{lectureTitle} · {course?.name}</p>
              </div>
              <div className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {formatTime(elapsed)}
              </div>
              {phase === "recording" && (
                <div className="flex gap-2">
                  {paused ? (
                    <button onClick={resumeRecording} className="btn btn-ghost flex items-center gap-1.5 text-sm border border-slate-300 dark:border-slate-600">
                      <Play className="w-4 h-4 text-green-600" /> Resume
                    </button>
                  ) : (
                    <button onClick={pauseRecording} className="btn btn-ghost flex items-center gap-1.5 text-sm border border-slate-300 dark:border-slate-600">
                      <Pause className="w-4 h-4 text-amber-600" /> Pause
                    </button>
                  )}
                  <button onClick={stopRecording} className="btn flex items-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white">
                    <Square className="w-4 h-4" /> Stop
                  </button>
                </div>
              )}
              {phase === "done" && (
                <div className="flex gap-2">
                  <button onClick={copyTranscript} className="btn btn-ghost flex items-center gap-1.5 text-sm border border-slate-200 dark:border-slate-700">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={downloadTranscript} className="btn btn-ghost flex items-center gap-1.5 text-sm border border-slate-200 dark:border-slate-700">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              )}
            </div>

            {/* Live transcript */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Live Transcript
                  <span className="badge badge-gray text-xs">{transcript.length} lines</span>
                </h3>
              </div>
              <div className="h-80 overflow-y-auto space-y-3 pr-1">
                {transcript.length === 0 && !currentLine && (
                  <p className="text-slate-400 text-sm text-center py-12">Start speaking — your words will appear here</p>
                )}
                {transcript.map((line, i) => (
                  <div key={i} className="flex gap-3 group">
                    <span className="text-xs text-slate-400 font-mono tabular-nums mt-0.5 flex-shrink-0 w-14">{line.timestamp}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{line.text}</p>
                  </div>
                ))}
                {currentLine && (
                  <div className="flex gap-3 opacity-60">
                    <span className="text-xs text-slate-400 font-mono mt-0.5 w-14">…</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic leading-relaxed">{currentLine}</p>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* AI Summary */}
            {phase === "done" && (
              <div className="card border-amber-200 dark:border-amber-800">
                <button
                  onClick={() => setShowSummary(s => !s)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">AI Lecture Summary</h3>
                    {generatingSummary && <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />}
                  </div>
                  {showSummary ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {showSummary && (
                  <div className="mt-4">
                    {generatingSummary ? (
                      <div className="space-y-2">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className={`skeleton h-4 rounded ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
                        ))}
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed bg-transparent border-0 p-0">{summary}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="card">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Session Stats</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Duration", value: formatTime(elapsed), icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
                  { label: "Lines captured", value: transcript.length, icon: <FileText className="w-3.5 h-3.5 text-slate-400" /> },
                  { label: "Words", value: transcript.reduce((s, l) => s + l.text.split(" ").length, 0), icon: <BookOpen className="w-3.5 h-3.5 text-slate-400" /> },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      {stat.icon}{stat.label}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email attendees */}
            {phase === "done" && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-4 h-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Email to Classmates</h3>
                </div>
                <div className="space-y-2 mb-4">
                  {DEMO_ATTENDEES.map(att => (
                    <label key={att.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAttendees.includes(att.id)}
                        onChange={e => setSelectedAttendees(prev =>
                          e.target.checked ? [...prev, att.id] : prev.filter(id => id !== att.id)
                        )}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{att.name}</p>
                        <p className="text-xs text-slate-400">{att.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Will send: transcript ({transcript.length} lines) + AI summary
                </p>
                {emailStatus === "sent" ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Sent to {selectedAttendees.length} classmates!
                  </div>
                ) : emailStatus === "error" ? (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
                    <AlertCircle className="w-4 h-4" /> Failed to send. Try again.
                  </div>
                ) : (
                  <button
                    onClick={sendEmails}
                    disabled={emailStatus === "sending" || selectedAttendees.length === 0 || !summary}
                    className="btn btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {emailStatus === "sending" ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Send to {selectedAttendees.length} classmates</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Attendees */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Class Members</h3>
              </div>
              <div className="space-y-2">
                {DEMO_ATTENDEES.map(att => (
                  <div key={att.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300">
                      {att.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{att.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
