"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Guide = {
  id: number;
  name: string;
  committee: string;
  conference: string;
  format: string;
  description: string;
  status: string;
  version: string;
  is_default: boolean;
  created_at: string;
};

type PaperResult = {
  id: number;
  delegation: string;
  committee: string;
  topic: string;
  word_count: number;
  content: string;
  ai_score?: number | null;
  humanize_passes?: number;
  score_history?: number[];
  provider?: string | null;
  created_at?: string;
};

type SiteContent = {
  hero_title: string;
  hero_subtitle: string;
  ticker_text: string;
  popup_title: string;
  popup_body: string;
  popup_enabled: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const WAITING_VIDEO = "https://files.catbox.moe/r1ge4f.mov";
const PAST_KEY = "mun_past_generations";

function loadPast(): PaperResult[] {
  try {
    const raw = localStorage.getItem(PAST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaperResult[];
  } catch {
    return [];
  }
}

function savePast(items: PaperResult[]) {
  localStorage.setItem(PAST_KEY, JSON.stringify(items.slice(0, 30)));
}

export default function Home() {
  const [delegation, setDelegation] = useState("France");
  const [committee, setCommittee] = useState("UNHRC");
  const [wordCount, setWordCount] = useState(700);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [studyGuideFile, setStudyGuideFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready");
  const [paper, setPaper] = useState<PaperResult | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>({
    hero_title: "Position paper studio",
    hero_subtitle: "A calm place to prepare delegate papers from your committee's own source material.",
    ticker_text: "Source-led writing workspace",
    popup_title: "Welcome to the studio",
    popup_body: "Upload your committee materials and begin with a grounded first draft.",
    popup_enabled: false,
  });
  const [showPopup, setShowPopup] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [videoEnded, setVideoEnded] = useState(false);
  const [pendingPaper, setPendingPaper] = useState<PaperResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [past, setPast] = useState<PaperResult[]>([]);
  const [showPast, setShowPast] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    setPast(loadPast());
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (videoEnded && pendingPaper && !isGenerating) {
      setPaper(pendingPaper);
      setShowResult(true);
      const entry = {
        ...pendingPaper,
        created_at: new Date().toISOString(),
      };
      const next = [entry, ...loadPast()].slice(0, 30);
      savePast(next);
      setPast(next);
    }
  }, [videoEnded, pendingPaper, isGenerating]);

  const loadGuides = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/guides`);
      if (response.ok) setGuides(await response.json());
    } catch {
      setGuides([]);
    }
  };

  const loadSiteContent = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/site-content`);
      if (response.ok) setSiteContent(await response.json());
    } catch {
      /* keep defaults */
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGuides();
      void loadSiteContent();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const guideSummary = useMemo(() => {
    if (!guides.length) return "No guide uploaded yet.";
    return guides.map((g) => `${g.name} (${g.committee || "General"})`).join(" • ");
  }, [guides]);

  async function generatePaper() {
    if (!studyGuideFile) {
      setStatus("Please upload a study guide.");
      return;
    }

    setIsGenerating(true);
    setVideoEnded(false);
    setPendingPaper(null);
    setShowResult(false);
    setPaper(null);
    setLogs([]);
    addLog("Starting generation…");
    addLog("Please do not close this screen or the popup — generation will stop if you leave.");

    const formData = new FormData();
    formData.append("delegation", delegation);
    formData.append("committee", committee);
    formData.append("word_count", String(wordCount));
    formData.append("topic", "");
    formData.append("additional_instructions", additionalInstructions);
    formData.append("file", studyGuideFile);

    const statusSteps = [
      "Uploading study guide…",
      "Generating base draft with Gemini…",
      "Pass 1 – first humanizer…",
      "Checking AI score with ZeroGPT…",
      "Pass 2 – rotating humanizer…",
      "Re-checking AI score (target < 5%)…",
      "Pass 3 – next provider…",
      "Pass 4 – continuing rotation…",
      "Pass 5 – final humanizers…",
      "Final verification & packaging…",
    ];

    let stepIndex = 0;
    setStatus(statusSteps[0]);
    addLog(statusSteps[0]);

    const statusInterval = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, statusSteps.length - 1);
      setStatus(statusSteps[stepIndex]);
      addLog(statusSteps[stepIndex]);
    }, 8000);

    setTimeout(() => {
      videoRef.current?.play().catch(() => {
        addLog("Video autoplay blocked — click the video to play.");
      });
    }, 400);

    try {
      const response = await fetch(`${API_BASE}/api/generate-from-upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const raw = await response.text();
        let detail = raw;
        try {
          const errJson = JSON.parse(raw);
          detail = errJson.detail || raw;
        } catch {
          /* keep raw */
        }
        throw new Error(detail || `Generation failed (${response.status})`);
      }
      const data = await response.json();
      const result: PaperResult = {
        id: data.id,
        delegation,
        committee,
        topic: "Detected from study guide",
        word_count: wordCount,
        content: data.content,
        ai_score: data.ai_score,
        humanize_passes: data.humanize_passes,
        score_history: data.score_history,
        provider: data.provider,
      };
      addLog(
        `Generation complete. AI score: ${data.ai_score ?? "n/a"}% · passes: ${data.humanize_passes ?? 0}`
      );
      addLog("Waiting for video to finish before showing the paper…");
      setPendingPaper(result);
      setIsGenerating(false);
      setStatus("Generation finished — waiting for video to end…");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Generation failed.";
      addLog(`Error: ${msg}`);
      setStatus(msg);
      setIsGenerating(false);
      setPendingPaper(null);
    } finally {
      window.clearInterval(statusInterval);
    }
  }

  function handleVideoEnded() {
    setVideoEnded(true);
    addLog("Video finished.");
    if (pendingPaper) {
      setPaper(pendingPaper);
      setShowResult(true);
      setStatus(
        pendingPaper.ai_score != null
          ? `Humanized position paper ready. AI score: ${pendingPaper.ai_score}%`
          : "Humanized position paper ready."
      );
    }
  }

  function closeGeneratingModal() {
    if (isGenerating || (pendingPaper && !showResult)) {
      // warn but allow close only if error state
      if (!pendingPaper && !isGenerating) {
        setLogs([]);
      }
    }
  }

  function copyText() {
    if (!paper?.content) return;
    navigator.clipboard.writeText(paper.content).then(() => setStatus("Copied to clipboard."));
  }

  function downloadTxt() {
    if (!paper?.content) return;
    const blob = new Blob([paper.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `position-paper-${paper.delegation}-${paper.committee}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDocx() {
    if (!paper?.content) return;
    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Position Paper</title></head>
<body style="font-family: Times New Roman, serif; font-size: 12pt; line-height: 1.5;">
${paper.content
  .split("\n")
  .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</p>`)
  .join("")}
</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `position-paper-${paper.delegation}-${paper.committee}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    if (!paper?.content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Position Paper</title>
      <style>
        body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; max-width: 700px; margin: 40px auto; white-space: pre-wrap; }
      </style></head>
      <body>${paper.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function openPastItem(item: PaperResult) {
    setPaper(item);
    setShowResult(true);
    setShowPast(false);
    setStatus(`Loaded past paper: ${item.delegation} · ${item.committee}`);
  }

  function clearPast() {
    localStorage.removeItem(PAST_KEY);
    setPast([]);
  }

  const showGeneratingModal = isGenerating || (pendingPaper && !showResult);

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#242321]">
      <div className="mx-auto max-w-[1500px] px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        <header className="mb-10 flex items-start justify-between gap-6 border-b border-[#d9d4cb] pb-6">
          <div>
            <p className="eyebrow">MUN Secretariat / Workspace</p>
            <h1 className="display-heading mt-3 text-4xl sm:text-5xl">{siteContent.hero_title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#716d66]">{siteContent.hero_subtitle}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" className="quiet-button hidden sm:inline-flex" onClick={() => setShowPast(true)}>
              Past generations
            </button>
            <a href="/admin" className="quiet-button hidden sm:inline-flex">
              Open admin <span aria-hidden="true">↘</span>
            </a>
          </div>
        </header>

        <div className="ticker-bar">
          <span className="status-dot" />
          {siteContent.ticker_text}
          <button onClick={() => setShowPopup(true)}>View note</button>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <span className="eyebrow">Library</span>
            <strong>{guides.length.toString().padStart(2, "0")}</strong>
            <span>active guides</span>
          </div>
          <div className="stat-card">
            <span className="eyebrow">Current guide</span>
            <strong className="truncate text-2xl">{guides.find((g) => g.is_default)?.name || "Not selected"}</strong>
            <span>default source</span>
          </div>
          <div className="stat-card">
            <span className="eyebrow">Workspace status</span>
            <strong className="text-2xl">Ready</strong>
            <span>{guideSummary}</span>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="paper-panel order-2 xl:order-1">
            <div className="section-heading">
              <div>
                <p className="eyebrow">01 / Compose</p>
                <h2>Build a paper</h2>
              </div>
              <span className="section-note">Delegate workspace</span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="field">
                <span>Delegation</span>
                <input value={delegation} onChange={(e) => setDelegation(e.target.value)} />
              </label>
              <label className="field">
                <span>Committee</span>
                <input value={committee} onChange={(e) => setCommittee(e.target.value)} />
              </label>
            </div>
            <label className="field mt-5">
              <span>Study guide</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setStudyGuideFile(e.target.files?.[0] || null)}
                className="file-input"
              />
              <small>{studyGuideFile ? studyGuideFile.name : "PDF, DOCX, or TXT · the issue context for this paper"}</small>
            </label>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="field">
                <span>Topic</span>
                <input value="Detected from study guide" disabled />
              </label>
              <label className="field">
                <span>Word count</span>
                <input type="number" value={wordCount} onChange={(e) => setWordCount(Number(e.target.value || 700))} />
              </label>
            </div>
            <label className="field mt-5">
              <span>
                Direction for the writer <em>Optional</em>
              </span>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={5}
                placeholder="Emphasize a policy, tone, or issue you want represented..."
              />
            </label>
            <div className="mt-7 flex flex-col gap-4 border-t border-[#e2ded7] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={generatePaper}
                className="primary-button"
                disabled={!!showGeneratingModal}
              >
                Generate position paper <span aria-hidden="true">→</span>
              </button>
              <p className="status-line">
                <span className="status-dot" />
                {status}
              </p>
            </div>
          </section>

          <aside className="order-1 space-y-8 xl:order-2">
            <section className="accent-panel">
              <p className="eyebrow text-[#d8c7b1]">A considered first draft</p>
              <h2 className="display-heading mt-3 text-3xl text-[#fffaf2]">Start with the brief. End with your voice.</h2>
              <p className="mt-4 text-sm leading-6 text-[#c6bbae]">
                Upload the study guide, add the delegation, and let the source material keep the argument grounded.
              </p>
            </section>
            <section id="guide-library" className="paper-panel compact-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">02 / Sources</p>
                  <h2>Guide library</h2>
                </div>
                <a href="/admin" className="section-note underline">
                  Manage
                </a>
              </div>
              <p className="mb-5 text-sm leading-6 text-[#716d66]">
                Position paper rules are kept here as the format reference for every draft.
              </p>
              <div className="space-y-3">
                {guides.length === 0 ? (
                  <p className="text-sm text-[#716d66]">Your library is empty.</p>
                ) : (
                  guides.map((guide) => (
                    <div key={guide.id} className="guide-row">
                      <div>
                        <strong>{guide.name}</strong>
                        <span>
                          {guide.committee || "General"} · {guide.conference || "All conferences"}
                        </span>
                      </div>
                      <span className="guide-status">{guide.status}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        {showResult && paper && (
          <section className="paper-panel mt-8">
            <div className="section-heading">
              <div>
                <p className="eyebrow">03 / Review</p>
                <h2>Humanized position paper</h2>
              </div>
              <span className="section-note">
                {paper.word_count} words
                {paper.ai_score != null && (
                  <>
                    {" "}
                    · AI score {paper.ai_score}% {paper.ai_score <= 5 ? "✓" : ""}
                  </>
                )}
              </span>
            </div>
            <p className="mb-5 text-sm text-[#716d66]">
              {paper.delegation} · {paper.committee}
              {paper.humanize_passes != null && paper.humanize_passes > 0 && (
                <>
                  {" "}
                  · Humanized in {paper.humanize_passes} pass{paper.humanize_passes > 1 ? "es" : ""}
                </>
              )}
              {paper.provider && <> · {paper.provider}</>}
            </p>
            {paper.ai_score != null && (
              <p className="mb-4 text-sm font-medium text-[#5c574f]">
                AI probability: <strong>{paper.ai_score}%</strong>
                {paper.ai_score <= 5 ? " — under the 5% target ✓" : " — still above target after max passes"}
              </p>
            )}

            <div className="mb-5 flex flex-wrap gap-3">
              <button type="button" onClick={copyText} className="primary-button">
                Copy text
              </button>
              <button type="button" onClick={printPdf} className="quiet-button">
                Save as PDF
              </button>
              <button type="button" onClick={downloadDocx} className="quiet-button">
                Save as Word
              </button>
              <button type="button" onClick={downloadTxt} className="quiet-button">
                Save as TXT
              </button>
            </div>

            <div className="paper-output whitespace-pre-wrap">{paper.content}</div>
          </section>
        )}
      </div>

      {/* GENERATING POPUP MODAL */}
      {showGeneratingModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 100 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: "820px",
              width: "92vw",
              maxHeight: "92vh",
              overflow: "auto",
              padding: "1.25rem 1.5rem 1.5rem",
            }}
          >
            <p className="eyebrow">Generating</p>
            <h2 className="display-heading mt-2 text-3xl">Please wait</h2>

            <div
              className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
              style={{ border: "1px solid #fcd34d", background: "#fffbeb", color: "#78350f" }}
            >
              Please do not close this screen / pop-up or else generation will stop.
            </div>

            <div
              className="relative mt-4 w-full overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: "16/9", maxHeight: "360px" }}
            >
              <video
                ref={videoRef}
                src={WAITING_VIDEO}
                className="h-full w-full object-contain"
                controls
                playsInline
                onEnded={handleVideoEnded}
                onError={() => addLog("Video failed to load.")}
              />
            </div>

            <div
              className="mt-4 max-h-44 overflow-y-auto rounded-lg border p-4 font-mono text-xs leading-5"
              style={{ background: "#1a1a18", color: "#c8c4bc", borderColor: "#333" }}
            >
              {logs.length === 0 ? (
                <span style={{ color: "#716d66" }}>Waiting for logs…</span>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>

            <p className="mt-4 text-sm text-[#716d66]">
              {isGenerating
                ? "Working… the position paper will appear only after the video ends."
                : "Generation finished. Waiting for the video to end before revealing the paper."}
            </p>
          </div>
        </div>
      )}

      {/* PAST GENERATIONS MODAL */}
      {showPast && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: "640px", width: "92vw", maxHeight: "85vh", overflow: "auto" }}>
            <button className="modal-close" onClick={() => setShowPast(false)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">History</p>
            <h2 className="display-heading mt-2 text-3xl">Past generations</h2>
            <p className="mt-2 text-sm text-[#716d66]">Stored in this browser only (localStorage).</p>
            <div className="mt-5 space-y-3">
              {past.length === 0 ? (
                <p className="text-sm text-[#716d66]">No past papers yet.</p>
              ) : (
                past.map((item, idx) => (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    className="guide-row w-full text-left"
                    onClick={() => openPastItem(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      <strong>
                        {item.delegation} · {item.committee}
                      </strong>
                      <span>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                        {item.ai_score != null ? ` · AI ${item.ai_score}%` : ""}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {past.length > 0 && (
              <button type="button" className="quiet-button mt-5" onClick={clearPast}>
                Clear history
              </button>
            )}
          </div>
        </div>
      )}

      {showPopup && siteContent.popup_enabled && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" onClick={() => setShowPopup(false)} aria-label="Close note">
              ×
            </button>
            <p className="eyebrow">From the Secretariat</p>
            <h2 className="display-heading mt-3 text-3xl">{siteContent.popup_title}</h2>
            <p className="mt-4 text-sm leading-6 text-[#716d66]">{siteContent.popup_body}</p>
          </div>
        </div>
      )}
    </main>
  );
}
