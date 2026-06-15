"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThumbnailPlan, ThumbnailVariant, Niche } from "@/lib/types";
import { apiFetch, useToast, ErrorState, PageSkeleton, EmptyState, NicheBadge, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { fmtDate } from "@/lib/format";

const THUMB_STYLES: { key: ThumbnailVariant["style"]; label: string; template: string }[] = [
  { key: "dark_moody", label: "Dark Moody", template: "Cinematic, dark moody atmosphere, dramatic lighting, {subject}, 4K quality, film grain, dark blue and gold color palette, mysterious vibe, {ratio}, no text, no watermark" },
  { key: "minimal", label: "Minimal", template: "Ultra clean minimalist design, single {subject} centered, solid dark navy background, gold accent lighting, {ratio}, professional, no text, no watermark" },
  { key: "face_closeup", label: "Face Close-up", template: "Extreme close-up portrait, intense eyes, dramatic side lighting, {subject}, dark background with gold rim light, {ratio}, cinematic, no text, no watermark" },
  { key: "text_heavy", label: "Bold Text", template: "Dark navy background, dramatic gold typography layout space, {subject} faded in background, cinematic lighting, {ratio}, editorial style, no watermark" },
];

export default function ThumbnailsPage() {
  const { activeId } = useChannel();
  const [plans, setPlans] = useState<ThumbnailPlan[]>([]);
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [thumbs, nichesRaw] = await Promise.all([
        apiFetch<{ plans: ThumbnailPlan[] }>("/api/thumbnails"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      setPlans(thumbs.plans || []);
      setNiches(JSON.parse(nichesRaw.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton rows={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Thumbnails</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Generate AI prompts, track A/B variants, mark winners. Playbook: 3 variants per long-form video.
        </p>
      </header>

      <PromptGenerator niches={niches} />
      <CreatePlan niches={niches} onCreated={load} toast={toast} />
      <PlanList plans={plans} niches={niches} onChanged={load} toast={toast} />
    </div>
  );
}

/* -------- prompt generator (instant, no save) -------- */
function PromptGenerator({ niches }: { niches: Record<string, Niche> }) {
  const [format, setFormat] = useState<"short" | "long">("long");
  const [niche, setNiche] = useState(Object.keys(niches)[0] || "");
  const [subject, setSubject] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const ratio = format === "short" ? "portrait 9:16" : "landscape 16:9";
  const subjectText = subject.trim() || `${niches[niche]?.label || niche} concept, psychology of success`;

  function copy(prompt: string, key: string) {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="card">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(!open)}>
        <h2 className="text-lg font-semibold">Prompt Generator</h2>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Format</label>
              <div className="flex gap-2">
                {(["short", "long"] as const).map((f) => (
                  <button key={f} type="button" className={`btn btn-sm flex-1 ${format === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFormat(f)}>
                    {f === "short" ? "9:16" : "16:9"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Niche</label>
              <select className="select" value={niche} onChange={(e) => setNiche(e.target.value)}>
                {Object.entries(niches).map(([k, n]) => <option key={k} value={k}>{n.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="label">Subject (optional)</label>
              <input className="input" placeholder="Auto: niche concept" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {THUMB_STYLES.map((style) => {
              const prompt = style.template.replace("{subject}", subjectText).replace("{ratio}", ratio);
              return (
                <div key={style.key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">{style.label}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copy(prompt, style.key)}
                      style={{ color: copied === style.key ? "var(--success)" : undefined }}
                    >
                      {copied === style.key ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{prompt}</p>
                </div>
              );
            })}
          </div>

          <p className="text-[0.7rem]" style={{ color: "var(--text-muted)" }}>
            Paste into Fal AI, Midjourney, or DALL-E. Generate 3 variants per video, then use YouTube Test &amp; Compare to A/B test.
          </p>
        </div>
      )}
    </section>
  );
}

/* -------- create plan -------- */
function CreatePlan({ niches, onCreated, toast }: { niches: Record<string, Niche>; onCreated: () => void; toast: ReturnType<typeof useToast> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState(Object.keys(niches)[0] || "");
  const [format, setFormat] = useState<"short" | "long">("long");
  const [subject, setSubject] = useState("");
  const [styles, setStyles] = useState<ThumbnailVariant["style"][]>(["dark_moody", "minimal", "face_closeup"]);

  function toggleStyle(s: ThumbnailVariant["style"]) {
    setStyles((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || styles.length === 0) return;
    setSaving(true);
    const ratio = format === "short" ? "portrait 9:16" : "landscape 16:9";
    const subjectText = subject.trim() || `${niches[niche]?.label || niche} concept, psychology of success`;
    const variants = styles.map((s) => {
      const tpl = THUMB_STYLES.find((x) => x.key === s)!;
      return {
        style: s,
        prompt: tpl.template.replace("{subject}", subjectText).replace("{ratio}", ratio),
      };
    });
    try {
      await apiFetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", title: title.trim(), niche, variants }),
      });
      toast.success("Thumbnail plan created");
      setTitle("");
      setSubject("");
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + New Thumbnail Plan
      </button>
    );
  }

  return (
    <form onSubmit={create} className="card space-y-3">
      <h2 className="text-lg font-semibold">New Thumbnail Plan</h2>
      <input className="input" placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Niche</label>
          <select className="select" value={niche} onChange={(e) => setNiche(e.target.value)}>
            {Object.entries(niches).map(([k, n]) => <option key={k} value={k}>{n.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Format</label>
          <div className="flex gap-2">
            {(["short", "long"] as const).map((f) => (
              <button key={f} type="button" className={`btn btn-sm flex-1 ${format === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFormat(f)}>
                {f === "short" ? "Short" : "Long"}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="label">Subject (optional)</label>
          <input className="input" placeholder="Auto-filled from niche" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Styles to generate</label>
        <div className="flex flex-wrap gap-2">
          {THUMB_STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`btn btn-sm ${styles.includes(s.key) ? "btn-primary" : "btn-secondary"}`}
              onClick={() => toggleStyle(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving || !title.trim() || styles.length === 0}>
          {saving ? <Spinner /> : `Create ${styles.length} variant${styles.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/* -------- plan list -------- */
function PlanList({ plans, niches, onChanged, toast }: { plans: ThumbnailPlan[]; niches: Record<string, Niche>; onChanged: () => void; toast: ReturnType<typeof useToast> }) {
  const sorted = useMemo(() => [...plans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [plans]);

  async function deletePlan(videoId: string) {
    if (!confirm("Delete this thumbnail plan?")) return;
    try {
      await apiFetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", video_id: videoId }),
      });
      onChanged();
      toast.success("Plan deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function setWinner(videoId: string, variantId: string) {
    try {
      await apiFetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_winner", video_id: videoId, variant_id: variantId }),
      });
      onChanged();
      toast.success("Winner marked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Thumbnail Plans ({plans.length})</h2>
      {sorted.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No thumbnail plans yet"
            hint="Create a plan per video to track your A/B test variants and pick winners."
            icon="🎨"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((plan) => (
            <PlanCard
              key={plan.video_id}
              plan={plan}
              niches={niches}
              onDelete={() => deletePlan(plan.video_id)}
              onSetWinner={(vid) => setWinner(plan.video_id, vid)}
              toast={toast}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* -------- single plan card -------- */
function PlanCard({ plan, niches, onDelete, onSetWinner, toast, onChanged }: {
  plan: ThumbnailPlan;
  niches: Record<string, Niche>;
  onDelete: () => void;
  onSetWinner: (variantId: string) => void;
  toast: ReturnType<typeof useToast>;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const winner = plan.variants.find((v) => v.winner);
  const nicheInfo = plan.niche ? niches[plan.niche] : null;

  function copy(prompt: string, id: string) {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function updateNotes(variantId: string, notes: string) {
    try {
      await apiFetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_variant", video_id: plan.video_id, variant_id: variantId, notes }),
      });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const styleLabel = (s: string) => THUMB_STYLES.find((x) => x.key === s)?.label || s;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <button className="flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{plan.title}</span>
            {nicheInfo && <NicheBadge label={nicheInfo.label} color={nicheInfo.color} />}
            {winner && (
              <span className="badge" style={{ background: "var(--success)22", color: "var(--success)" }}>
                Winner: {styleLabel(winner.style)}
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {plan.variants.length} variants · {fmtDate(plan.created_at)}
          </div>
        </button>
        <button className="icon-btn shrink-0" style={{ color: "var(--error)" }} aria-label="Delete plan" onClick={onDelete}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {plan.variants.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-lg border"
              style={{
                borderColor: v.winner ? "var(--success)" : "var(--border)",
                background: v.winner ? "var(--success)08" : "var(--bg)",
              }}
            >
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{styleLabel(v.style)}</span>
                  {v.winner && <span className="text-[0.7rem]" style={{ color: "var(--success)" }}>★ Winner</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copy(v.prompt, v.id)}
                    style={{ color: copied === v.id ? "var(--success)" : undefined }}
                  >
                    {copied === v.id ? "Copied!" : "Copy"}
                  </button>
                  {!v.winner && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--success)" }}
                      onClick={() => onSetWinner(v.id)}
                      title="Mark as A/B test winner"
                    >
                      Set Winner
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-muted)" }}>{v.prompt}</p>
              <input
                className="input text-xs"
                placeholder="Notes (e.g., CTR result, impressions, feedback)"
                defaultValue={v.notes || ""}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (v.notes || "")) updateNotes(v.id, val);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
