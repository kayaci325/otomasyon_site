"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { UpcomingSlot, WorkflowRun, Niche, CalendarConfig, VideoPerf, Settings, DecisionsData } from "@/lib/types";
import { getUpcomingSlots } from "@/lib/calendar-utils";
import { apiFetch, ErrorState, PageSkeleton, EmptyState, FormatBadge, NicheBadge, StatusDot } from "@/components/ui";
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

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { slots, runs, perf, settings, markers } = data;
  const t = settings.thresholds ?? { ctr_alarm: 0, avd_alarm: 0, shorts_apv_target: 0, max_videos_per_day: 0 };

  // This week's published videos + aggregates
  const since = now - WEEK_MS;
  const weekly = perf.filter((v) => new Date(v.published_at).getTime() >= since);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
  const weekViews = sum(weekly.map((v) => v.views));
  const weekSubs = sum(weekly.map((v) => v.subs_gained));
  const weekRet = avg(weekly.map((v) => v.retention));

  // Alarms: any tracked video breaching the configured thresholds
  const alarms: string[] = [];
  for (const v of perf) {
    if (v.ctr && v.ctr < t.ctr_alarm) alarms.push(`"${v.title}" CTR ${v.ctr}% < ${t.ctr_alarm}%`);
    if (v.retention && v.retention < t.avd_alarm) alarms.push(`"${v.title}" retention ${v.retention}% < ${t.avd_alarm}%`);
    if (v.format === "short" && v.apv && v.apv < t.shorts_apv_target) alarms.push(`"${v.title}" APV ${v.apv}% < ${t.shorts_apv_target}%`);
  }

  // Monetization (2026 dual path) + playbook phase
  const subs = markers.subscribers ?? 0;
  const hours = markers.watch_hours ?? 0;
  const shortsViews = markers.shorts_views_90d ?? 0;
  const totalVideos = perf.length;
  const phase =
    totalVideos < 28 ? { name: "Calibration", hint: `${totalVideos}/28 videos to first review` }
    : totalVideos < 60 ? { name: "Double-down", hint: "Scale winners, cut losers" }
    : { name: "Dominance", hint: "Sequels, multi-platform, A/B thumbnails" };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>MindPower command center</p>
      </header>

      {alarms.length > 0 && (
        <section className="card" style={{ borderColor: "var(--error)" }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--error)" }}>
            ⚠ {alarms.length} performance alarm{alarms.length > 1 ? "s" : ""}
          </h2>
          <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            {alarms.slice(0, 5).map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
          <Link href="/performance" className="text-xs font-semibold mt-2 inline-block" style={{ color: "var(--gold)" }}>
            Review on Performance →
          </Link>
        </section>
      )}

      {/* This week's scoreboard */}
      <section>
        <h2 className="text-lg font-semibold mb-3">This Week</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Videos" value={String(weekly.length)} color="var(--gold)" />
          <StatCard label="Views" value={weekViews.toLocaleString()} color="var(--text)" />
          <StatCard label="Subs gained" value={weekSubs.toLocaleString()} color="var(--success)" />
          <StatCard
            label="Avg retention"
            value={weekly.length ? `${weekRet.toFixed(0)}%` : "—"}
            color={weekly.length && weekRet < t.avd_alarm ? "var(--error)" : "var(--text)"}
          />
        </div>
        {weekly.length === 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            No videos logged this week. Add results on the <Link href="/performance" className="underline" style={{ color: "var(--gold)" }}>Performance</Link> page after publishing.
          </p>
        )}
      </section>

      {/* Monetization + phase */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Monetization progress</h3>
          <Progress label="Subscribers" value={subs} target={1000} />
          <Progress label="Watch hours" value={hours} target={4000} />
          <Progress label="Shorts views (90d)" value={shortsViews} target={10_000_000} />
          <p className="text-[0.7rem] mt-2" style={{ color: "var(--text-muted)" }}>
            Eligible at 1,000 subs + (4,000 watch hours OR 10M Shorts views/90d). Update numbers on Performance.
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-1">Playbook phase</h3>
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{phase.name}</div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{phase.hint}</p>
          <div className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            {totalVideos} videos tracked · avg CTR {perf.length ? `${avg(perf.map(v=>v.ctr)).toFixed(1)}%` : "—"}
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upcoming Slots</h2>
          <Link href="/calendar" className="text-xs font-semibold" style={{ color: "var(--gold)" }}>Calendar →</Link>
        </div>
        <div className="space-y-2">
          {slots.length === 0 && <div className="card"><EmptyState title="No upcoming slots" hint="Define your weekly plan on the Calendar." icon="🗓" /></div>}
          {slots.map((slot, i) => (
            <div key={i} className="card flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FormatBadge format={slot.format} />
                <NicheBadge label={slot.niche_label} color={slot.niche_color} />
              </div>
              <div className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{fmtDateTime(slot.publish_at)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent runs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Pipeline Runs</h2>
          <Link href="/videos" className="text-xs font-semibold" style={{ color: "var(--gold)" }}>All runs →</Link>
        </div>
        <div className="space-y-2">
          {runs.length === 0 && <div className="card"><EmptyState title="No pipeline runs yet" hint="Trigger one from Produce." icon="⚙️" action={<Link href="/produce" className="btn btn-primary btn-sm">Produce a video</Link>} /></div>}
          {runs.map((run) => (
            <a key={run.id} href={run.html_url} target="_blank" rel="noopener noreferrer" className="card card-link flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusDot status={run.conclusion || run.status} />
                <div>
                  <span className="text-sm font-medium">Run #{run.run_number}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                    {run.event === "workflow_dispatch" ? "Manual" : run.event}
                  </span>
                </div>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDateTime(run.created_at)}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{value.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : "var(--gold)" }} />
      </div>
    </div>
  );
}
