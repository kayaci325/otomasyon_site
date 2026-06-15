"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VideoPerf, Niche, Settings, DecisionsData, WeeklyDecision } from "@/lib/types";
import { apiFetch, useToast, ErrorState, PageSkeleton, EmptyState, FormatBadge, NicheBadge, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { fmtDate } from "@/lib/format";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export default function PerformancePage() {
  const { activeId } = useChannel();
  const [videos, setVideos] = useState<VideoPerf[]>([]);
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [thresholds, setThresholds] = useState<Settings["thresholds"] | null>(null);
  const [decisions, setDecisions] = useState<DecisionsData>({ decisions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [perf, nichesRaw, settings, dec] = await Promise.all([
        apiFetch<{ videos: VideoPerf[] }>("/api/performance"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
        apiFetch<Settings>("/api/settings"),
        apiFetch<DecisionsData>("/api/decisions"),
      ]);
      setVideos(perf.videos || []);
      setNiches(JSON.parse(nichesRaw.content));
      setThresholds(settings.thresholds);
      setDecisions(dec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton rows={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Performance</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>The weekly data loop — log results, spot winners, kill losers.</p>
      </header>

      <Scoreboard videos={videos} thresholds={thresholds} />
      <Markers decisions={decisions} onSaved={load} toastError={(m) => toast.error(m)} toastOk={(m) => toast.success(m)} />
      <AddVideo niches={niches} onAdded={load} toast={toast} />
      <Ledger videos={videos} niches={niches} thresholds={thresholds} onChanged={load} toast={toast} />
      <Decisions decisions={decisions.decisions} videos={videos} onChanged={load} toast={toast} />
    </div>
  );
}

/* -------- scoreboard -------- */
function Scoreboard({ videos, thresholds }: { videos: VideoPerf[]; thresholds: Settings["thresholds"] | null }) {
  const [now] = useState(() => Date.now());
  const since = now - WEEK_MS;
  const week = videos.filter((v) => new Date(v.published_at).getTime() >= since);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
  const ctr = avg(week.map((v) => v.ctr));
  const shorts = week.filter(v => v.format === "short");
  const longs = week.filter(v => v.format === "long");
  const shortsApv = avg(shorts.map(v => v.apv));
  const longsRet = avg(longs.map(v => v.retention));
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>This Week</h2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Stat label="Videos" value={String(week.length)} />
        <Stat label="Views" value={sum(week.map((v) => v.views)).toLocaleString()} />
        <Stat label="Subs" value={`+${sum(week.map((v) => v.subs_gained))}`} />
        <Stat label="Avg CTR" value={week.length ? `${ctr.toFixed(1)}%` : "—"} alarm={!!thresholds && week.length > 0 && ctr < thresholds.ctr_alarm} />
        <Stat label="Shorts APV" value={shorts.length ? `${shortsApv.toFixed(0)}%` : "—"} alarm={!!thresholds && shorts.length > 0 && shortsApv < thresholds.shorts_apv_target} />
        <Stat label="Long Ret." value={longs.length ? `${longsRet.toFixed(0)}%` : "—"} alarm={!!thresholds && longs.length > 0 && longsRet < thresholds.avd_alarm} />
      </div>
    </section>
  );
}
function Stat({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className="card text-center">
      <div className="text-xl font-bold" style={{ color: alarm ? "var(--error)" : "var(--text)" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

/* -------- monetization markers -------- */
function Markers({ decisions, onSaved, toastOk, toastError }: { decisions: DecisionsData; onSaved: () => void; toastOk: (m: string) => void; toastError: (m: string) => void; }) {
  const [subs, setSubs] = useState(String(decisions.subscribers ?? 0));
  const [hours, setHours] = useState(String(decisions.watch_hours ?? 0));
  const [sv, setSv] = useState(String(decisions.shorts_views_90d ?? 0));
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/decisions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "markers",
          subscribers: subs.trim() === "" ? (decisions.subscribers ?? 0) : Number(subs) || 0,
          watch_hours: hours.trim() === "" ? (decisions.watch_hours ?? 0) : Number(hours) || 0,
          shorts_views_90d: sv.trim() === "" ? (decisions.shorts_views_90d ?? 0) : Number(sv) || 0,
        }),
      });
      toastOk("Channel numbers updated"); onSaved();
    } catch (e) { toastError(e instanceof Error ? e.message : "Save failed"); }
    setSaving(false);
  }
  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-3">Channel Numbers</h2>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Subscribers</label><input className="input" type="number" min={0} value={subs} onChange={(e) => setSubs(e.target.value)} /></div>
        <div><label className="label">Watch hours</label><input className="input" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <div><label className="label">Shorts views (90d)</label><input className="input" type="number" min={0} value={sv} onChange={(e) => setSv(e.target.value)} /></div>
      </div>
      <button className="btn btn-secondary btn-sm mt-3" onClick={save} disabled={saving}>{saving ? <Spinner /> : "Update numbers"}</button>
    </section>
  );
}

/* -------- add video -------- */
function AddVideo({ niches, onAdded, toast }: { niches: Record<string, Niche>; onAdded: () => void; toast: ReturnType<typeof useToast>; }) {
  const empty = { title: "", youtube_url: "", niche: "", format: "short", hook: "", published_at: new Date().toISOString().slice(0, 10), views: "", ctr: "", retention: "", apv: "", subs_gained: "" };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  function set(k: string, v: string) { setF((p) => ({ ...p, [k]: v })); }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/performance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ...f, views: Number(f.views) || 0, ctr: Number(f.ctr) || 0, retention: Number(f.retention) || 0, apv: Number(f.apv) || 0, subs_gained: Number(f.subs_gained) || 0 }),
      });
      setF(empty); setOpen(false); onAdded(); toast.success("Video logged");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
    setSaving(false);
  }
  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Log a published video</button>;
  return (
    <form onSubmit={add} className="card space-y-3">
      <h2 className="text-lg font-semibold">Log Published Video</h2>
      <input className="input" placeholder="Video title" value={f.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" />
      <input className="input" placeholder="YouTube URL (optional)" value={f.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} aria-label="YouTube URL" />
      <div className="grid grid-cols-2 gap-3">
        <select className="select" value={f.niche} onChange={(e) => set("niche", e.target.value)} aria-label="Niche">
          <option value="">Niche…</option>
          {Object.entries(niches).map(([k, n]) => <option key={k} value={k}>{n.label}</option>)}
        </select>
        <select className="select" value={f.format} onChange={(e) => set("format", e.target.value)} aria-label="Format">
          <option value="short">Short</option>
          <option value="long">Long</option>
        </select>
        <div><label className="label">Published</label><input className="input" type="date" value={f.published_at} onChange={(e) => set("published_at", e.target.value)} /></div>
        <input className="input self-end" placeholder="Hook formula (optional)" value={f.hook} onChange={(e) => set("hook", e.target.value)} aria-label="Hook" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div><label className="label">Views</label><input className="input" type="number" min={0} value={f.views} onChange={(e) => set("views", e.target.value)} /></div>
        <div><label className="label">CTR %</label><input className="input" type="number" min={0} step={0.1} value={f.ctr} onChange={(e) => set("ctr", e.target.value)} /></div>
        <div><label className="label">Retention %</label><input className="input" type="number" min={0} step={1} value={f.retention} onChange={(e) => set("retention", e.target.value)} /></div>
        <div><label className="label">APV %</label><input className="input" type="number" min={0} step={1} value={f.apv} onChange={(e) => set("apv", e.target.value)} /></div>
        <div><label className="label">Subs gained</label><input className="input" type="number" value={f.subs_gained} onChange={(e) => set("subs_gained", e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving || !f.title.trim()}>{saving ? <Spinner /> : "Save video"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/* -------- ledger table -------- */
function Ledger({ videos, niches, thresholds, onChanged, toast }: { videos: VideoPerf[]; niches: Record<string, Niche>; thresholds: Settings["thresholds"] | null; onChanged: () => void; toast: ReturnType<typeof useToast>; }) {
  const sorted = useMemo(() => [...videos].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()), [videos]);
  async function del(v: VideoPerf) {
    if (!confirm(`Delete "${v.title}" from the ledger?`)) return;
    try {
      await apiFetch("/api/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: v.id }) });
      onChanged(); toast.success("Removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }
  const low = (val: number, limit?: number) => limit !== undefined && val > 0 && val < limit;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Video Ledger ({videos.length})</h2>
      {sorted.length === 0 ? (
        <div className="card"><EmptyState title="No videos logged yet" hint="After publishing, log each video's metrics here to run your weekly review." icon="📊" /></div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Video</th><th>Niche</th><th>Fmt</th><th>Published</th>
                <th>Views</th><th>CTR</th><th>Ret.</th><th>APV</th><th>Subs</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.id}>
                  <td className="max-w-[200px]">
                    {v.youtube_url ? <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--gold)" }}>{v.title}</a> : v.title}
                    {v.hook && <div className="text-[0.7rem] italic" style={{ color: "var(--text-muted)" }}>{v.hook}</div>}
                  </td>
                  <td>{v.niche && niches[v.niche] ? <NicheBadge label={niches[v.niche].label} color={niches[v.niche].color} /> : "—"}</td>
                  <td><FormatBadge format={v.format} /></td>
                  <td className="whitespace-nowrap">{fmtDate(v.published_at)}</td>
                  <td>{v.views.toLocaleString()}</td>
                  <td style={{ color: low(v.ctr, thresholds?.ctr_alarm) ? "var(--error)" : undefined }}>{v.ctr || "—"}</td>
                  <td style={{ color: low(v.retention, thresholds?.avd_alarm) ? "var(--error)" : undefined }}>{v.retention || "—"}</td>
                  <td style={{ color: v.format === "short" && low(v.apv, thresholds?.shorts_apv_target) ? "var(--error)" : undefined }}>{v.apv || "—"}</td>
                  <td>{v.subs_gained || "—"}</td>
                  <td><button className="icon-btn" style={{ color: "var(--error)" }} aria-label="Delete video" onClick={() => del(v)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* -------- decisions log -------- */
function Decisions({ decisions, videos, onChanged, toast }: { decisions: WeeklyDecision[]; videos: VideoPerf[]; onChanged: () => void; toast: ReturnType<typeof useToast>; }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const empty = { week_of: mondayOf(), best_video: "", worst_video: "", diagnosis: "", variable_changed: "" };
  const [f, setF] = useState(empty);
  function set(k: string, v: string) { setF((p) => ({ ...p, [k]: v })); }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    // One-variable guard (the cardinal playbook rule)
    if (/\band\b|[,;]|\n/i.test(f.variable_changed.trim())) {
      if (!confirm("This looks like more than one change. The playbook says change ONLY ONE variable per week. Log it anyway?")) return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", ...f }) });
      setF(empty); setOpen(false); onChanged(); toast.success("Decision logged");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to log"); }
    setSaving(false);
  }
  async function del(id: string) {
    try {
      await apiFetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      onChanged(); toast.success("Removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }
  const topPick = videos.slice().sort((a, b) => b.views - a.views)[0];
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Weekly Decisions</h2>
        {!open && <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>+ Log this week</button>}
      </div>
      {open && (
        <form onSubmit={add} className="card space-y-3 mb-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Week of</label><input className="input" type="date" value={f.week_of} onChange={(e) => set("week_of", e.target.value)} /></div>
            <div className="self-end text-xs" style={{ color: "var(--text-muted)" }}>{topPick ? `Top video: ${topPick.title}` : ""}</div>
          </div>
          <input className="input" placeholder="Best video — and why it flew" value={f.best_video} onChange={(e) => set("best_video", e.target.value)} />
          <input className="input" placeholder="Worst video — one-sentence diagnosis" value={f.worst_video} onChange={(e) => set("worst_video", e.target.value)} />
          <textarea className="textarea" placeholder="Diagnosis / notes" value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} />
          <div>
            <input className="input" placeholder="The ONE variable changed this week" value={f.variable_changed} onChange={(e) => set("variable_changed", e.target.value)} />
            <p className="text-[0.7rem] mt-1" style={{ color: "var(--warning)" }}>Change only one variable per week — otherwise you can&apos;t tell what worked.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : "Log decision"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {decisions.length === 0 && !open && <div className="card"><EmptyState title="No decisions logged" hint="Each Monday: best, worst, and the one change." icon="🧭" /></div>}
        {decisions.map((d) => (
          <div key={d.id} className="card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Week of {fmtDate(d.week_of)}</span>
              <button className="icon-btn" style={{ color: "var(--error)" }} aria-label="Delete decision" onClick={() => del(d.id)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg></button>
            </div>
            {d.best_video && <p className="text-xs mt-1"><span style={{ color: "var(--success)" }}>▲ Best:</span> {d.best_video}</p>}
            {d.worst_video && <p className="text-xs mt-0.5"><span style={{ color: "var(--error)" }}>▼ Worst:</span> {d.worst_video}</p>}
            {d.diagnosis && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.diagnosis}</p>}
            {d.variable_changed && <p className="text-xs mt-1" style={{ color: "var(--gold)" }}>Changed: {d.variable_changed}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
