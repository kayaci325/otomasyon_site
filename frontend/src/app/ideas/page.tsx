"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Idea, Niche } from "@/lib/types";
import { apiFetch, useToast, ErrorState, EmptyState, NicheBadge, FormatBadge, Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [text, setText] = useState("");
  const [hook, setHook] = useState("");
  const [niche, setNiche] = useState("");
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "starred" | "inbox">("all");
  const toast = useToast();
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ideasData, nichesRaw] = await Promise.all([
        apiFetch<{ ideas: Idea[] }>("/api/ideas"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      setIdeas(ideasData.ideas || []);
      setNiches(JSON.parse(nichesRaw.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(body: object) {
    return apiFetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await post({ action: "add", text: text.trim(), hook: hook.trim() || null, niche: niche || null, format: format || null });
      setText(""); setHook(""); setNiche(""); setFormat("");
      await load();
      toast.success("Idea added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
    setSaving(false);
  }

  async function toggleStar(idea: Idea) {
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, starred: !i.starred } : i))); // optimistic
    try {
      await post({ action: "star", id: idea.id });
    } catch {
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, starred: idea.starred } : i)));
      toast.error("Couldn't update star");
    }
  }

  async function deleteIdea(idea: Idea) {
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id)); // optimistic
    try {
      await post({ action: "delete", id: idea.id });
      toast.toast("Idea deleted", "info", {
        label: "Undo",
        onClick: async () => {
          try {
            await post({ action: "add", text: idea.text, hook: idea.hook, niche: idea.niche, format: idea.format });
            await load();
          } catch { toast.error("Undo failed"); }
        },
      });
    } catch (e) {
      setIdeas((prev) => [idea, ...prev]);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function sendToProduce(idea: Idea) {
    const params = new URLSearchParams();
    if (idea.format) params.set("format", idea.format);
    if (idea.niche) params.set("niche", idea.niche);
    if (idea.text) params.set("topic", idea.text);
    post({ action: "update", id: idea.id, updates: { status: "produced" } }).catch(() => {});
    router.push(`/produce?${params.toString()}`);
  }

  const counts = {
    all: ideas.length,
    starred: ideas.filter((i) => i.starred).length,
    inbox: ideas.filter((i) => i.status === "inbox").length,
  };
  const filtered = ideas.filter((i) => (filter === "starred" ? i.starred : filter === "inbox" ? i.status === "inbox" : true));

  if (loading) return <div className="max-w-3xl mx-auto"><div className="card h-24 mb-3 animate-pulse" />{[0,1,2].map(i=><div key={i} className="card h-16 mb-2 animate-pulse" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Idea Bank</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Capture ideas from anywhere. {ideas.length} total.</p>
      </header>

      <form onSubmit={addIdea} className="card space-y-3">
        <input className="input" placeholder="New idea… (e.g. '7 body language signs of a liar')" value={text} onChange={(e) => setText(e.target.value)} aria-label="Idea text" />
        <input className="input" placeholder="Hook formula (optional) — what makes them stop scrolling?" value={hook} onChange={(e) => setHook(e.target.value)} aria-label="Hook formula" />
        <div className="flex gap-2 flex-wrap">
          <select className="select flex-1 min-w-[140px]" value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Niche">
            <option value="">Auto-detect niche</option>
            {Object.entries(niches).map(([key, n]) => <option key={key} value={key}>{n.label}</option>)}
          </select>
          <select className="select flex-1 min-w-[100px]" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
            <option value="">Any format</option>
            <option value="short">Short</option>
            <option value="long">Long</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={saving || !text.trim()}>
            {saving ? <Spinner /> : "Add"}
          </button>
        </div>
      </form>

      <div className="flex gap-2">
        {(["all", "starred", "inbox"] as const).map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "starred" ? "Starred" : "Inbox"} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="card"><EmptyState title="No ideas here yet" hint="Capture your first idea above." icon="💡" /></div>}
        {filtered.map((idea) => (
          <div key={idea.id} className="card flex items-start gap-3">
            <button
              onClick={() => toggleStar(idea)}
              className="icon-btn shrink-0"
              style={{ color: idea.starred ? "var(--gold)" : "var(--text-muted)" }}
              aria-label={idea.starred ? "Unstar idea" : "Star idea"}
              aria-pressed={idea.starred}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={idea.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.13 4.32 4.77.69-3.45 3.36.82 4.75L11.48 14.8 7.2 16.62l.81-4.75-3.45-3.36 4.77-.69L11.48 3.5z" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{idea.text}</p>
              {idea.hook && <p className="text-xs mt-1 italic" style={{ color: "var(--gold)" }}>Hook: {idea.hook}</p>}
              <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                {idea.niche && niches[idea.niche] && <NicheBadge label={niches[idea.niche].label} color={niches[idea.niche].color} />}
                {idea.format && <FormatBadge format={idea.format} />}
                {idea.status === "produced" && <span className="badge" style={{ background: "var(--success)22", color: "var(--success)" }}>Produced</span>}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(idea.created_at)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => sendToProduce(idea)} className="btn btn-secondary btn-sm" aria-label="Send idea to Produce">Produce</button>
              <button onClick={() => deleteIdea(idea)} className="icon-btn" aria-label="Delete idea" style={{ color: "var(--error)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
