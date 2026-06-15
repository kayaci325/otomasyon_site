"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkflowRun } from "@/lib/types";
import { apiFetch, ErrorState, EmptyState, StatusBadge, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { statusColor, humanizeStatus, fmtDateTime } from "@/lib/format";

export default function RunsPage() {
  const { activeId } = useChannel();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "failure">("all");

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ videos: WorkflowRun[] }>("/api/videos");
      setRuns(data.videos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    if (soft) setRefreshing(false); else setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (runs.some(r => !r.conclusion)) {
      const t = setInterval(() => load(true), 20000);
      return () => clearInterval(t);
    }
  }, [runs, load]);

  const counts = {
    all: runs.length,
    success: runs.filter((r) => r.conclusion === "success").length,
    failure: runs.filter((r) => r.conclusion === "failure").length,
  };
  const filtered = runs.filter((r) => (filter === "success" ? r.conclusion === "success" : filter === "failure" ? r.conclusion === "failure" : true));

  if (loading) return <div className="max-w-4xl mx-auto space-y-2">{[0,1,2,3,4].map(i=><div key={i} className="card h-16 animate-pulse" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Pipeline Runs</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{runs.length} GitHub Actions runs</p>
        </div>
        <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <><Spinner /> Refreshing…</> : "Refresh"}
        </button>
      </header>

      <div className="flex gap-2">
        {(["all", "success", "failure"] as const).map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "success" ? "Success" : "Failed"} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="card"><EmptyState title="No runs found" hint="Trigger a run from the Produce page." icon="⚙️" /></div>}
        {filtered.map((run) => {
          const status = run.conclusion || run.status;
          const dt = new Date(run.created_at);
          const duration = run.updated_at ? Math.round((new Date(run.updated_at).getTime() - dt.getTime()) / 60000) : null;
          return (
            <a key={run.id} href={run.html_url} target="_blank" rel="noopener noreferrer" className="card card-link flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: statusColor(status) + "22", color: statusColor(status) }} aria-label={humanizeStatus(status)} title={humanizeStatus(status)}>
                  {status === "success" ? "✓" : status === "failure" ? "✕" : status === "in_progress" ? <span className="animate-spin-slow">↻</span> : "•"}
                </span>
                <div>
                  <div className="text-sm font-medium">Run #{run.run_number}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {run.event === "workflow_dispatch" ? "Manual" : run.event}{duration !== null && duration >= 0 ? ` · ${duration} min` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={status} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDateTime(run.created_at)}</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
