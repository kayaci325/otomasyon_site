"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Niche } from "@/lib/types";
import { apiFetch, useToast, Switch, Spinner, ErrorState } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";

function ProduceInner() {
  const params = useSearchParams();
  const { active } = useChannel();
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
    if (upload && !confirm(`This will produce AND publish to "${active?.name || "YouTube"}". Continue?`)) return;
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
        <h1 className="text-xl font-bold" style={{ color: "var(--gold)" }}>Produce Video</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Producing for <span style={{ color: "var(--gold)" }}>{active?.name || "—"}</span> · Runs via GitHub Actions
        </p>
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

      {/* Thumbnail Prompt Generator */}
      <ThumbnailGenerator
        format={format}
        niche={niche}
        nicheLabel={niches[niche]?.label || niche}
        topic={topic}
      />

      <div className="card">
        <h3 className="text-sm font-semibold mb-2">Quick Tips</h3>
        <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
          <li>• Shorts: 50-80 words, hook-body-closer, loops back for replay</li>
          <li>• Long: 1200-1800 words, 3 sections with re-engagement every 3 min</li>
          <li>• Pipeline takes ~5-10 minutes (script + TTS + visuals + assembly)</li>
          <li>• Red line: never 3+ days same niche; respect your daily video cap</li>
          <li>• Thumbnails: generate 3 variants, use YouTube Test &amp; Compare for A/B</li>
        </ul>
      </div>
    </div>
  );
}

const THUMB_STYLES = [
  { key: "dark_moody", label: "Dark Moody", template: "Cinematic, dark moody atmosphere, dramatic lighting, {subject}, 4K quality, film grain, dark blue and gold color palette, mysterious vibe, {ratio}, no text, no watermark" },
  { key: "minimal", label: "Minimal", template: "Ultra clean minimalist design, single {subject} centered, solid dark navy background, gold accent lighting, {ratio}, professional, no text, no watermark" },
  { key: "face_closeup", label: "Face Close-up", template: "Extreme close-up portrait, intense eyes, dramatic side lighting, {subject}, dark background with gold rim light, {ratio}, cinematic, no text, no watermark" },
  { key: "text_heavy", label: "Bold Text", template: "Dark navy background, dramatic gold typography layout space, {subject} faded in background, cinematic lighting, {ratio}, editorial style, no watermark" },
] as const;

function ThumbnailGenerator({ format, niche, nicheLabel, topic }: { format: string; niche: string; nicheLabel: string; topic: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const ratio = format === "short" ? "portrait 9:16" : "landscape 16:9";
  const subject = topic.trim() || `${nicheLabel} concept, psychology of success`;

  function copyPrompt(prompt: string, key: string) {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!open) {
    return (
      <button className="btn btn-secondary w-full" onClick={() => setOpen(true)}>
        Generate Thumbnail Prompts
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Thumbnail Prompts</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        3 style variants for &quot;{subject}&quot; · {format === "short" ? "9:16" : "16:9"} · Copy and paste into Fal AI, Midjourney, or DALL-E
      </p>
      <div className="space-y-2">
        {THUMB_STYLES.slice(0, 3).map((style) => {
          const prompt = style.template.replace("{subject}", subject).replace("{ratio}", ratio);
          return (
            <div key={style.key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{style.label}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyPrompt(prompt, style.key)}
                  style={{ color: copied === style.key ? "var(--success)" : undefined }}
                >
                  {copied === style.key ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{prompt}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[0.7rem]" style={{ color: "var(--text-muted)" }}>
        Playbook: Generate 3 thumbnails per long-form video, use YouTube &quot;Test &amp; Compare&quot; to A/B test them.
      </p>
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
