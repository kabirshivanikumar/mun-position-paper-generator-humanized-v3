"use client";

import { useEffect, useMemo, useState } from "react";

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

  const loadGuides = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/guides`);
      if (response.ok) {
        const data = await response.json();
        setGuides(data);
      }
    } catch {
      setGuides([]);
    }
  };

  const loadSiteContent = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/site-content`);
      if (response.ok) setSiteContent(await response.json());
    } catch {
      // Keep the local defaults when the API is unavailable.
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
    return guides.map((guide) => `${guide.name} (${guide.committee || "General"})`).join(" • ");
  }, [guides]);

  async function generatePaper() {
    if (!studyGuideFile) {
      setStatus("Please upload a study guide.");
      return;
    }

    const formData = new FormData();
    formData.append("delegation", delegation);
    formData.append("committee", committee);
    formData.append("word_count", String(wordCount));
    formData.append("topic", "");
    formData.append("additional_instructions", additionalInstructions);
    formData.append("file", studyGuideFile);

    // Progressive status updates while the longer humanized generation runs
    const statusSteps = [
      "Generating base draft with Gemini...",
      "Sending to AIHumanizerAPI (pass 1 of 4)...",
      "Checking AI score with Sapling...",
      "Humanizing pass 2...",
      "Re-checking AI score (target < 5%)...",
      "Humanizing pass 3 if still needed...",
      "Final verification & packaging...",
    ];
    let stepIndex = 0;
    setStatus(statusSteps[0]);

    const statusInterval = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, statusSteps.length - 1);
      setStatus(statusSteps[stepIndex]);
    }, 7000);

    try {
      const response = await fetch(`${API_BASE}/api/generate-from-upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Generation failed");
      }
      const data = await response.json();
      setPaper({
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
      });
      const scoreText =
        data.ai_score != null
          ? ` AI score: ${data.ai_score}% (target < 5%).`
          : "";
      setStatus(`Humanized position paper ready.${scoreText}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      window.clearInterval(statusInterval);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#242321]">
      <div className="mx-auto max-w-[1500px] px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        <header className="mb-10 flex items-start justify-between gap-6 border-b border-[#d9d4cb] pb-6">
          <div>
            <p className="eyebrow">MUN Secretariat / Workspace</p>
            <h1 className="display-heading mt-3 text-4xl sm:text-5xl">{siteContent.hero_title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#716d66]">{siteContent.hero_subtitle}</p>
          </div>
          <a href="/admin" className="quiet-button hidden sm:inline-flex">Open admin <span aria-hidden="true">↘</span></a>
        </header>

        <div className="ticker-bar"><span className="status-dot" />{siteContent.ticker_text}<button onClick={() => setShowPopup(true)}>View note</button></div>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="stat-card"><span className="eyebrow">Library</span><strong>{guides.length.toString().padStart(2, "0")}</strong><span>active guides</span></div>
          <div className="stat-card"><span className="eyebrow">Current guide</span><strong className="truncate text-2xl">{guides.find((g) => g.is_default)?.name || "Not selected"}</strong><span>default source</span></div>
          <div className="stat-card"><span className="eyebrow">Workspace status</span><strong className="text-2xl">Ready</strong><span>{guideSummary}</span></div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="paper-panel order-2 xl:order-1">
            <div className="section-heading"><div><p className="eyebrow">01 / Compose</p><h2>Build a paper</h2></div><span className="section-note">Delegate workspace</span></div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="field"><span>Delegation</span><input value={delegation} onChange={(e) => setDelegation(e.target.value)} /></label>
              <label className="field"><span>Committee</span><input value={committee} onChange={(e) => setCommittee(e.target.value)} /></label>
            </div>
            <label className="field mt-5"><span>Study guide</span><input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setStudyGuideFile(e.target.files?.[0] || null)} className="file-input" /><small>{studyGuideFile ? studyGuideFile.name : "PDF, DOCX, or TXT · the issue context for this paper"}</small></label>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="field"><span>Topic</span><input value="Detected from study guide" disabled /></label>
              <label className="field"><span>Word count</span><input type="number" value={wordCount} onChange={(e) => setWordCount(Number(e.target.value || 700))} /></label>
            </div>
            <label className="field mt-5"><span>Direction for the writer <em>Optional</em></span><textarea value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} rows={5} placeholder="Emphasize a policy, tone, or issue you want represented..." /></label>
            <div className="mt-7 flex flex-col gap-4 border-t border-[#e2ded7] pt-6 sm:flex-row sm:items-center sm:justify-between"><button onClick={generatePaper} className="primary-button">Generate position paper <span aria-hidden="true">→</span></button><p className="status-line"><span className="status-dot" />{status}</p></div>
          </section>

          <aside className="order-1 space-y-8 xl:order-2">
            <section className="accent-panel"><p className="eyebrow text-[#d8c7b1]">A considered first draft</p><h2 className="display-heading mt-3 text-3xl text-[#fffaf2]">Start with the brief. End with your voice.</h2><p className="mt-4 text-sm leading-6 text-[#c6bbae]">Upload the study guide, add the delegation, and let the source material keep the argument grounded.</p></section>
            <section id="guide-library" className="paper-panel compact-panel"><div className="section-heading"><div><p className="eyebrow">02 / Sources</p><h2>Guide library</h2></div><a href="/admin" className="section-note underline">Manage</a></div><p className="mb-5 text-sm leading-6 text-[#716d66]">Position paper rules are kept here as the format reference for every draft.</p><div className="space-y-3">{guides.length === 0 ? <p className="text-sm text-[#716d66]">Your library is empty.</p> : guides.map((guide) => <div key={guide.id} className="guide-row"><div><strong>{guide.name}</strong><span>{guide.committee || "General"} · {guide.conference || "All conferences"}</span></div><span className="guide-status">{guide.status}</span></div>)}</div>
            </section>
          </aside>
        </div>

        {paper && (
          <section className="paper-panel mt-8">
            <div className="section-heading">
              <div>
                <p className="eyebrow">03 / Review</p>
                <h2>Humanized position paper</h2>
              </div>
              <span className="section-note">
                {paper.word_count} words
                {paper.ai_score != null && (
                  <> · AI score {paper.ai_score}% {paper.ai_score <= 5 ? "✓" : ""}</>
                )}
              </span>
            </div>
            <p className="mb-5 text-sm text-[#716d66]">
              {paper.delegation} · {paper.committee}
              {paper.humanize_passes != null && paper.humanize_passes > 0 && (
                <> · Humanized in {paper.humanize_passes} pass{paper.humanize_passes > 1 ? "es" : ""}</>
              )}
            </p>
            {paper.ai_score != null && (
              <p className="mb-4 text-sm font-medium text-[#5c574f]">
                AI probability (Sapling): <strong>{paper.ai_score}%</strong>
                {paper.ai_score <= 5
                  ? " — under the 5% target ✓"
                  : " — still above target after max passes"}
                {paper.provider && (
                  <> · Provider: {paper.provider}</>
                )}
              </p>
            )}
            <div className="paper-output">{paper.content}</div>
          </section>
        )}
      </div>
      {showPopup && siteContent.popup_enabled && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><button className="modal-close" onClick={() => setShowPopup(false)} aria-label="Close note">×</button><p className="eyebrow">From the Secretariat</p><h2 className="display-heading mt-3 text-3xl">{siteContent.popup_title}</h2><p className="mt-4 text-sm leading-6 text-[#716d66]">{siteContent.popup_body}</p></div></div>}
    </main>
  );
}
