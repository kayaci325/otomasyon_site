"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Niche } from "@/lib/types";
import { apiFetch, useToast, Switch, Spinner, ErrorState } from "@/components/ui";

function ProduceInner() {
  const params = useSearchParams();
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [format, setFormat] = useState(params.get("format") === "long" ? "long" : "short");
  const [niche, setNiche] = useState(params.get("niche") || "");
  const [topic, setTopic] = useState(params.get("topic") || "");
  const [upload, setUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [producing, setProducing] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      setError("");
      try {
        const data = await apiFetch<{ content: string }>("/api/github?path=config/niches.json");
        const parsed: Record<string, Niche> = JSON.parse(data.content);
        setNiches(parsed);
        setNiche((cur) => cur && parsed[cur] ? cur : Object.keys(parsed)[0] || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
      setLoading(false);
    })();
  }, []);

  async function handleProduce(e: React.FormEvent) {
    e.preventDefault();
    if (upload && !confirm("This will produce AND publish a video to YouTube. Continue?")) return;
    setProducing(true);
    setDone(false);
    try {
      await apiFetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, niche, topic: topic.trim() || undefined, upload }),
      });
      setDone(true);
      setTopic("");
      toast.success("Pipeline triggered");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to trigger");
    }
    setProducing(false);
  }

  if (loading) return <div className="max-w-2xl mx-auto"><div className="card h-80 animate-pulse" /></div>;
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Produce Video</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Trigger the pipeline manually. Runs via GitHub Actions.</p>
      </header>

      <form onSubmit={handleProduce} className="card space-y-4">
        <div>
          <label className="label">Format</label>
          <div className="flex gap-2">
            {["short", "long"].map((f) => (
              <button key={f} type="button" className={`btn flex-1 ${format === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFormat(f)} aria-pressed={format === f}>
                {f === "short" ? "Short (15-35s)" : "Long (8-12 min)"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="niche">Niche</label>
          <select id="niche" className="select" value={niche} onChange={(e) => setNiche(e.target.value)}>
            {Object.entries(niches).map(([key, n]) => <option key={key} value={key}>{n.label} — {n.series}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="topic">Topic (optional)</label>
          <input id="topic" className="input" placeholder="Leave empty for auto-select (60% evergreen / 40% trending)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={upload} onChange={setUpload} label="Upload to YouTube after production" />
          <span className="text-sm">Upload to YouTube after production</span>
        </div>

        <button type="submit" className="btn btn-primary w-full text-base py-3" disabled={producing}>
          {producing ? <><Spinner /> Triggering…</> : "Produce Now"}
        </button>

        {done && (
          <div className="rounded-lg p-3 text-sm text-center" style={{ background: "var(--success)22", color: "var(--success)" }}>
            Pipeline triggered. <Link href="/videos" className="underline font-semibold">View progress →</Link>
          </div>
        )}
      </form>

      <div className="card">
        <h3 className="text-sm font-semibold mb-2">Quick Tips</h3>
        <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
          <li>• Shorts: 50-80 words, hook-body-closer, loops back for replay</li>
          <li>• Long: 1200-1800 words, 3 sections with re-engagement every 3 min</li>
          <li>• Pipeline takes ~5-10 minutes (script + TTS + visuals + assembly)</li>
          <li>• Red line: never 3+ days same niche; respect your daily video cap</li>
        </ul>
      </div>
    </div>
  );
}

export default function ProducePage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto"><div className="card h-80 animate-pulse" /></div>}>
      <ProduceInner />
    </Suspense>
  );
}
