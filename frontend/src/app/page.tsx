"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { UpcomingSlot, WorkflowRun, Niche, CalendarConfig, VideoPerf, Settings, DecisionsData } from "@/lib/types";
import { getUpcomingSlots } from "@/lib/calendar-utils";
import { apiFetch, ErrorState, PageSkeleton, EmptyState, FormatBadge, NicheBadge, StatusDot } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { fmtDateTime } from "@/lib/format";

interface Loaded {
  slots: UpcomingSlot[];
  runs: WorkflowRun[];
  perf: VideoPerf[];
  settings: Settings;
  markers: DecisionsData;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { active } = useChannel();
  const [data, setData] = useState<Loaded | null>(null);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cal, nichesRaw, videos, perf, settings, decisions] = await Promise.all([
        apiFetch<CalendarConfig>("/api/calendar"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
        apiFetch<{ videos: WorkflowRun[] }>("/api/videos"),
        apiFetch<{ videos: VideoPerf[] }>("/api/performance"),
        apiFetch<Settings>("/api/settings"),
        apiFetch<DecisionsData>("/api/decisions"),
      ]);
      const niches: Record<string, Niche> = JSON.parse(nichesRaw.content);
      setData({
        slots: getUpcomingSlots(cal, niches, 5),
        runs: (videos.videos || []).slice(0, 5),
        perf: perf.videos || [],
        settings,
        markers: decisions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { slots, runs, perf, settings, markers } = data;
  const t = settings.thresholds ?? { ctr_alarm: 0, avd_alarm: 0, shorts_apv_target: 0, max_videos_per_day: 0 };

  const since = now - WEEK_MS;
  const weekly = perf.filter((v) => new Date(v.published_at).getTime() >= since);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
  const weekViews = sum(weekly.map((v) => v.views));
  const weekSubs = sum(weekly.map((v) => v.subs_gained));
  const weekShorts = weekly.filter(v => v.format === "short");
  const weekLongs = weekly.filter(v => v.format === "long");
  const shortsApv = avg(weekShorts.map(v => v.apv));
  const longsRet = avg(weekLongs.map(v => v.retention));
  const weekCtr = avg(weekly.map(v => v.ctr));

  const alarms: string[] = [];
  for (const v of perf) {
    if (v.ctr && v.ctr < t.ctr_alarm) alarms.push(`"${v.title}" CTR ${v.ctr}% < ${t.ctr_alarm}%`);
    if (v.format === "long" && v.retention && v.retention < t.avd_alarm) alarms.push(`"${v.title}" retention ${v.retention}% < ${t.avd_alarm}%`);
    if (v.format === "short" && v.apv && v.apv < t.shorts_apv_target) alarms.push(`"${v.title}" APV ${v.apv}% < ${t.shorts_apv_target}%`);
  }

  const subs = markers.subscribers ?? 0;
  const hours = markers.watch_hours ?? 0;
  const shortsViews = markers.shorts_views_90d ?? 0;
  const totalVideos = perf.length;
  const phase =
    totalVideos < 28 ? { name: "Calibration", color: "var(--warning)", hint: `${totalVideos}/28 videos to first review` }
    : totalVideos < 60 ? { name: "Double-down", color: "var(--gold)", hint: "Scale winners, cut losers" }
    : { name: "Dominance", color: "var(--success)", hint: "Sequels, multi-platform, A/B thumbnails" };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--gold)" }}>
            {active?.name || "MindPower"} Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {phase.name} phase · {totalVideos} videos tracked
          </p>
        </div>
        <span className="badge" style={{ background: phase.color + "22", color: phase.color }}>
          {phase.name}
        </span>
      </header>

      {alarms.length > 0 && (
        <div className="card" style={{ borderColor: "var(--error)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--error)22", color: "var(--error)" }}>!</span>
            <span className="text-sm font-semibold" style={{ color: "var(--error)" }}>
              {alarms.length} alarm{alarms.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="text-xs space-y-0.5" style={{ color: "var(--text-muted)" }}>
            {alarms.slice(0, 4).map((a, i) => <li key={i}>{a}</li>)}
            {alarms.length > 4 && <li>+{alarms.length - 4} more</li>}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>This Week</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <MetricCard label="Videos" value={String(weekly.length)} />
          <MetricCard label="Views" value={weekViews > 999 ? `${(weekViews / 1000).toFixed(1)}K` : String(weekViews)} />
          <MetricCard label="Subs" value={`+${weekSubs}`} color={weekSubs > 0 ? "var(--success)" : undefined} />
          <MetricCard label="Avg CTR" value={weekly.length ? `${weekCtr.toFixed(1)}%` : "—"} alarm={weekly.length > 0 && weekCtr < t.ctr_alarm} />
          <MetricCard label="Shorts APV" value={weekShorts.length ? `${shortsApv.toFixed(0)}%` : "—"} alarm={weekShorts.length > 0 && shortsApv < t.shorts_apv_target} />
          <MetricCard label="Long Ret." value={weekLongs.length ? `${longsRet.toFixed(0)}%` : "—"} alarm={weekLongs.length > 0 && longsRet < t.avd_alarm} />
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Monetization</h3>
          <ProgressBar label="Subscribers" value={subs} target={1000} />
          <ProgressBar label="Watch hours" value={hours} target={4000} />
          <ProgressBar label="Shorts views (90d)" value={shortsViews} target={10_000_000} />
        </div>
        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Phase</h3>
          <div className="text-xl font-bold mb-1" style={{ color: phase.color }}>{phase.name}</div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{phase.hint}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><span style={{ color: "var(--text-muted)" }}>Avg CTR:</span> {perf.length ? `${avg(perf.map(v=>v.ctr)).toFixed(1)}%` : "—"}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Avg APV:</span> {perf.filter(v=>v.format==="short").length ? `${avg(perf.filter(v=>v.format==="short").map(v=>v.apv)).toFixed(0)}%` : "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Upcoming</h2>
            <Link href="/calendar" className="text-xs font-medium" style={{ color: "var(--gold)" }}>View all</Link>
          </div>
          <div className="space-y-1.5">
            {slots.length === 0 && <div className="card py-6"><EmptyState title="No slots" hint="Set up your calendar" icon="📅" /></div>}
            {slots.map((slot, i) => (
              <div key={i} className="card flex items-center justify-between py-2.5 px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FormatBadge format={slot.format} />
                  <NicheBadge label={slot.niche_label} color={slot.niche_color} />
                </div>
                <span className="text-[0.7rem] shrink-0" style={{ color: "var(--text-muted)" }}>{fmtDateTime(slot.publish_at)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent Runs</h2>
            <Link href="/videos" className="text-xs font-medium" style={{ color: "var(--gold)" }}>View all</Link>
          </div>
          <div className="space-y-1.5">
            {runs.length === 0 && (
              <div className="card py-6">
                <EmptyState
                  title="No pipeline runs"
                  hint="Produce your first video"
                  icon="🎬"
                  action={<Link href="/produce" className="btn btn-primary btn-sm">Produce</Link>}
                />
              </div>
            )}
            {runs.map((run) => (
              <a key={run.id} href={run.html_url} target="_blank" rel="noopener noreferrer" className="card card-link flex items-center justify-between py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <StatusDot status={run.conclusion || run.status} />
                  <span className="text-sm font-medium">#{run.run_number}</span>
                </div>
                <span className="text-[0.7rem]" style={{ color: "var(--text-muted)" }}>{fmtDateTime(run.created_at)}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, alarm }: { label: string; value: string; color?: string; alarm?: boolean }) {
  return (
    <div className="card text-center py-3 px-2">
      <div className="text-lg font-bold" style={{ color: alarm ? "var(--error)" : color || "var(--text)" }}>{value}</div>
      <div className="text-[0.65rem] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function ProgressBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{value.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : "var(--gold)" }} />
      </div>
    </div>
  );
}
