"use client";

import { useCallback, useEffect, useState } from "react";
import type { Settings, Channel, Niche } from "@/lib/types";
import { apiFetch, useToast, ErrorState, PageSkeleton, NicheBadge, Spinner } from "@/components/ui";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [channels, setChannels] = useState<Record<string, Channel>>({});
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sData, cRaw, nRaw] = await Promise.all([
        apiFetch<Settings & { sha?: string }>("/api/settings"),
        apiFetch<{ content: string }>("/api/github?path=config/channels.json"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      delete sData.sha;
      setSettings(sData);
      setChannels(JSON.parse(cRaw.content));
      setNiches(JSON.parse(nRaw.content));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      setDirty(false);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  function updateField(section: keyof Settings, key: string, value: number | string | boolean) {
    if (!settings) return;
    setDirty(true);
    setSettings({ ...settings, [section]: { ...settings[section], [key]: value } });
  }

  if (loading) return <PageSkeleton rows={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10 py-2" style={{ background: "var(--bg)" }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Production &amp; channel configuration</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs" style={{ color: "var(--warning)" }}>Unsaved changes</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <><Spinner /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </header>

      <section className="card">
        <h2 className="text-lg font-semibold mb-1">Channels</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Overview (read-only)</p>
        {Object.entries(channels).map(([key, ch]) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full" style={{ background: ch.palette.accent }} aria-hidden="true" />
              <div>
                <div className="text-sm font-medium">{ch.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{ch.active_niches.length} niches · {ch.active ? "Active" : "Inactive"}</div>
              </div>
            </div>
            <span className="badge" style={{ background: ch.active ? "var(--success)22" : "var(--border)", color: ch.active ? "var(--success)" : "var(--text-muted)" }}>{ch.active ? "Active" : "Inactive"}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Production</h2>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Images (Short)" value={settings.production.images_per_short} min={1} max={60} onChange={(v) => updateField("production", "images_per_short", v)} />
          <NumberField label="Images (Long)" value={settings.production.images_per_long} min={1} max={200} onChange={(v) => updateField("production", "images_per_long", v)} />
          <NumberField label="FPS" value={settings.production.fps} min={1} max={120} onChange={(v) => updateField("production", "fps", v)} />
          <NumberField label="Music Vol (dB)" value={settings.production.music_volume_db} min={-60} max={0} step={0.5} onChange={(v) => updateField("production", "music_volume_db", v)} />
          <NumberField label="Trending %" value={Math.round(settings.production.trending_ratio * 100)} min={0} max={100} onChange={(v) => updateField("production", "trending_ratio", v / 100)} hint="Share of topics from trending vs evergreen" />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Text-to-Speech</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="tts-model">Model</label>
            <input id="tts-model" className="input" value={settings.tts.model_id} onChange={(e) => updateField("tts", "model_id", e.target.value)} />
          </div>
          <NumberField label="Stability" value={settings.tts.stability} min={0} max={1} step={0.05} onChange={(v) => updateField("tts", "stability", v)} />
          <NumberField label="Similarity Boost" value={settings.tts.similarity_boost} min={0} max={1} step={0.05} onChange={(v) => updateField("tts", "similarity_boost", v)} />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold mb-1">Performance Thresholds</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Drive the alarms on the Dashboard &amp; Performance pages.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="CTR Alarm (%)" value={settings.thresholds.ctr_alarm} min={0} max={100} step={0.5} onChange={(v) => updateField("thresholds", "ctr_alarm", v)} hint="Flag videos below this CTR" />
          <NumberField label="AVD/Retention Alarm (%)" value={settings.thresholds.avd_alarm} min={0} max={100} step={5} onChange={(v) => updateField("thresholds", "avd_alarm", v)} hint="Flag videos below this retention" />
          <NumberField label="Shorts APV Target (%)" value={settings.thresholds.shorts_apv_target} min={0} max={300} step={5} onChange={(v) => updateField("thresholds", "shorts_apv_target", v)} />
          <NumberField label="Max Videos/Day" value={settings.thresholds.max_videos_per_day} min={1} max={20} onChange={(v) => updateField("thresholds", "max_videos_per_day", v)} />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Active Niches</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(niches).map(([key, n]) => <NicheBadge key={key} label={n.label} color={n.color} />)}
        </div>
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, min, max, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (!Number.isFinite(v)) v = 0;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onChange(v);
        }}
      />
      {hint && <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}
