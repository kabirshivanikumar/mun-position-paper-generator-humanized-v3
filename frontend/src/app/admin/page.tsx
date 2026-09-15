"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Guide = {
  id: number;
  name: string;
  committee: string;
  conference: string;
  format: string;
  description: string;
  status: string;
  is_default: boolean;
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
const emptyContent: SiteContent = {
  hero_title: "",
  hero_subtitle: "",
  ticker_text: "",
  popup_title: "",
  popup_body: "",
  popup_enabled: false,
};

export default function AdminPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [credentials, setCredentials] = useState<string | null>(null);
  const [message, setMessage] = useState("Sign in to manage the workspace.");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [content, setContent] = useState<SiteContent>(emptyContent);
  const [guideFile, setGuideFile] = useState<File | null>(null);
  const [guideName, setGuideName] = useState("");
  const [guideCommittee, setGuideCommittee] = useState("");
  const [guideConference, setGuideConference] = useState("");
  const [guideFormat, setGuideFormat] = useState("");
  const [guideDescription, setGuideDescription] = useState("");

  function headers(auth = credentials): Record<string, string> {
    return auth ? { Authorization: auth } : {};
  }

  async function loadDashboard(auth: string) {
    const [guideResponse, contentResponse] = await Promise.all([
      fetch(`${API_BASE}/api/guides`),
      fetch(`${API_BASE}/api/site-content`),
    ]);
    if (!guideResponse.ok || !contentResponse.ok) throw new Error("Could not load dashboard data.");
    setGuides(await guideResponse.json());
    setContent(await contentResponse.json());
    setCredentials(auth);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    setMessage("Checking credentials...");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { Authorization: auth } });
      if (!response.ok) throw new Error("Incorrect username or password.");
      await loadDashboard(auth);
      setMessage("Signed in. Changes publish immediately.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    }
  }

  async function saveContent() {
    if (!credentials) return;
    const response = await fetch(`${API_BASE}/api/admin/site-content`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setMessage(response.ok ? "Homepage content saved." : "Could not save homepage content.");
  }

  async function uploadGuide() {
    if (!credentials || !guideFile) {
      setMessage("Choose a guide file first.");
      return;
    }
    const formData = new FormData();
    formData.append("name", guideName || guideFile.name);
    formData.append("committee", guideCommittee);
    formData.append("conference", guideConference);
    formData.append("format_name", guideFormat);
    formData.append("description", guideDescription);
    formData.append("file", guideFile);
    const response = await fetch(`${API_BASE}/api/admin/guides`, { method: "POST", headers: headers(), body: formData });
    if (!response.ok) {
      setMessage("Guide upload failed.");
      return;
    }
    setGuideFile(null);
    setGuideName("");
    setGuideCommittee("");
    setGuideConference("");
    setGuideFormat("");
    setGuideDescription("");
    await loadDashboard(credentials);
    setMessage("Guide added to the library.");
  }

  async function deleteGuide(id: number) {
    if (!credentials || !window.confirm("Delete this guide from the library?")) return;
    const response = await fetch(`${API_BASE}/api/admin/guides/${id}`, { method: "DELETE", headers: headers() });
    if (response.ok) await loadDashboard(credentials);
    setMessage(response.ok ? "Guide deleted." : "Could not delete guide.");
  }

  async function makeDefault(id: number) {
    if (!credentials) return;
    const response = await fetch(`${API_BASE}/api/admin/guides/${id}/default`, { method: "PUT", headers: headers() });
    if (response.ok) await loadDashboard(credentials);
    setMessage(response.ok ? "Default guide updated." : "Could not update the default guide.");
  }

  if (!credentials) {
    return <main className="admin-shell"><div className="login-card"><p className="eyebrow">MUN Secretariat / Admin</p><h1 className="display-heading mt-3 text-4xl">Control room</h1><p className="mt-4 text-sm leading-6 text-[#716d66]">Sign in to manage guides, homepage copy, ticker notices, and popups.</p><form onSubmit={signIn} className="mt-8 space-y-5"><label className="field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label><button className="primary-button w-full" type="submit">Enter dashboard <span aria-hidden="true">→</span></button></form><p className="status-line mt-5"><span className="status-dot" />{message}</p><Link href="/" className="back-link">← Back to studio</Link></div></main>;
  }

  return <main className="admin-shell"><div className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><header className="mb-10 flex items-end justify-between gap-6 border-b border-[#d9d4cb] pb-6"><div><p className="eyebrow">MUN Secretariat / Admin</p><h1 className="display-heading mt-3 text-4xl sm:text-5xl">Control room</h1></div><Link href="/" className="quiet-button">View studio <span aria-hidden="true">↗</span></Link></header><div className="grid gap-8 lg:grid-cols-2"><section className="paper-panel"><div className="section-heading"><div><p className="eyebrow">01 / Front page</p><h2>Edit the surface</h2></div><span className="section-note">Live copy</span></div><p className="mb-5 text-sm leading-6 text-[#716d66]">Tap a content panel, change the words, and save. Empty fields remove that text from the page.</p><div className="space-y-5"><label className="field"><span>Main heading</span><input value={content.hero_title} onChange={(event) => setContent({ ...content, hero_title: event.target.value })} /></label><label className="field"><span>Intro text</span><textarea rows={4} value={content.hero_subtitle} onChange={(event) => setContent({ ...content, hero_subtitle: event.target.value })} /></label><label className="field"><span>Ticker message</span><input value={content.ticker_text} onChange={(event) => setContent({ ...content, ticker_text: event.target.value })} /></label><label className="field"><span>Popup title</span><input value={content.popup_title} onChange={(event) => setContent({ ...content, popup_title: event.target.value })} /></label><label className="field"><span>Popup body</span><textarea rows={4} value={content.popup_body} onChange={(event) => setContent({ ...content, popup_body: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={content.popup_enabled} onChange={(event) => setContent({ ...content, popup_enabled: event.target.checked })} /><span>Show popup on the public page</span></label><button onClick={saveContent} className="primary-button">Publish content <span aria-hidden="true">↗</span></button><p className="status-line"><span className="status-dot" />{message}</p></div></section><section className="space-y-8"><div className="paper-panel"><div className="section-heading"><div><p className="eyebrow">02 / Sources</p><h2>Add a guide</h2></div><span className="section-note">PDF · DOCX · TXT</span></div><div className="space-y-5"><label className="field"><span>Guide file</span><input type="file" accept=".pdf,.docx,.txt" onChange={(event) => setGuideFile(event.target.files?.[0] || null)} className="file-input" /></label><label className="field"><span>Name</span><input value={guideName} onChange={(event) => setGuideName(event.target.value)} placeholder="e.g. NMUN 2026 Format Guide" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="field"><span>Committee</span><input value={guideCommittee} onChange={(event) => setGuideCommittee(event.target.value)} placeholder="UNHRC" /></label><label className="field"><span>Conference</span><input value={guideConference} onChange={(event) => setGuideConference(event.target.value)} placeholder="NMUN 2026" /></label></div><label className="field"><span>Format</span><input value={guideFormat} onChange={(event) => setGuideFormat(event.target.value)} placeholder="Position paper" /></label><label className="field"><span>Notes</span><textarea rows={3} value={guideDescription} onChange={(event) => setGuideDescription(event.target.value)} placeholder="What should this guide enforce?" /></label><button onClick={uploadGuide} className="secondary-button">Add to library <span aria-hidden="true">+</span></button></div></div><div className="paper-panel"><div className="section-heading"><div><p className="eyebrow">03 / Library</p><h2>Manage sources</h2></div><span className="section-note">{guides.length} total</span></div><div className="space-y-3">{guides.length === 0 ? <p className="text-sm text-[#716d66]">No guides uploaded yet.</p> : guides.map((guide) => <div className="admin-guide-row" key={guide.id}><div><strong>{guide.name}</strong><span>{guide.committee || "General"} · {guide.conference || "All conferences"}</span></div><div className="flex gap-2"><button onClick={() => makeDefault(guide.id)} className="mini-button">{guide.is_default ? "Default" : "Make default"}</button><button onClick={() => deleteGuide(guide.id)} className="mini-button danger">Delete</button></div></div>)}</div></div></section></div></div></main>;
}
