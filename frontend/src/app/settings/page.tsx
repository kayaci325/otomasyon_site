"use client";

import { useCallback, useEffect, useState } from "react";
import type { Settings, Channel, Niche, ChannelsMap } from "@/lib/types";
import { apiFetch, useToast, ErrorState, PageSkeleton, NicheBadge, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [channels, setChannels] = useState<ChannelsMap>({});
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { reload: reloadCtx } = useChannel();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, chRaw, nRaw] = await Promise.all([
        apiFetch<Settings>("/api/settings"),
        apiFetch<{ content: string }>("/api/github?path=config/channels.json"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      setSettings(s);
      setChannels(JSON.parse(chRaw.content));
      setNiches(JSON.parse(nRaw.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  async function saveChannels(updated: ChannelsMap) {
    setSaving(true);
    try {
      await apiFetch("/api/github", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "config/channels.json",
          content: JSON.stringify(updated, null, 2),
          message: "Update channels",
        }),
      });
      setChannels(updated);
      await reloadCtx();
      toast.success("Channels saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  if (loading) return <PageSkeleton rows={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  function updateProd(key: string, value: number | string) {
    setSettings((s) => s ? { ...s, production: { ...s.production, [key]: value } } : s);
  }
  function updateThreshold(key: string, value: number) {
    setSettings((s) => s ? { ...s, thresholds: { ...s.thresholds, [key]: value } } : s);
  }
  function updateTts(key: string, value: string | number) {
    setSettings((s) => s ? { ...s, tts: { ...s.tts, [key]: value } } : s);
  }
  function updateYoutube(key: string, value: string | boolean) {
    setSettings((s) => s ? { ...s, youtube: { ...s.youtube, [key]: value } } : s);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--gold)" }}>Settings</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Production, thresholds &amp; channel management</p>
        </div>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? <Spinner /> : "Save Settings"}
        </button>
      </header>

      {/* Channels Management */}
      <ChannelManager channels={channels} niches={niches} onSave={saveChannels} saving={saving} />

      {/* Production */}
      <section className="card">
        <h2 className="text-sm font-semibold mb-3">Production</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Images (Short)" value={settings.production.images_per_short} onChange={(v) => updateProd("images_per_short", Number(v))} />
          <Field label="Images (Long)" value={settings.production.images_per_long} onChange={(v) => updateProd("images_per_long", Number(v))} />
          <Field label="FPS" value={settings.production.fps} onChange={(v) => updateProd("fps", Number(v))} />
          <Field label="Music Vol (dB)" value={settings.production.music_volume_db} onChange={(v) => updateProd("music_volume_db", Number(v))} step={1} />
          <Field label="Trending %" value={settings.production.trending_ratio} onChange={(v) => updateProd("trending_ratio", Number(v))} step={0.1} />
          <Field label="Subtitle Font" value={settings.production.subtitle_font} onChange={(v) => updateProd("subtitle_font", v)} type="text" />
        </div>
      </section>

      {/* Thresholds / Alarms */}
      <section className="card">
        <h2 className="text-sm font-semibold mb-3">Alarm Thresholds</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="CTR alarm (%)" value={settings.thresholds.ctr_alarm} onChange={(v) => updateThreshold("ctr_alarm", Number(v))} step={0.5} />
          <Field label="Long retention alarm (%)" value={settings.thresholds.avd_alarm} onChange={(v) => updateThreshold("avd_alarm", Number(v))} step={1} />
          <Field label="Shorts APV target (%)" value={settings.thresholds.shorts_apv_target} onChange={(v) => updateThreshold("shorts_apv_target", Number(v))} step={5} />
          <Field label="Max videos/day" value={settings.thresholds.max_videos_per_day} onChange={(v) => updateThreshold("max_videos_per_day", Number(v))} />
        </div>
      </section>

      {/* TTS */}
      <section className="card">
        <h2 className="text-sm font-semibold mb-3">Text-to-Speech</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Model ID" value={settings.tts.model_id} onChange={(v) => updateTts("model_id", v)} type="text" />
          <Field label="Stability" value={settings.tts.stability} onChange={(v) => updateTts("stability", Number(v))} step={0.05} />
          <Field label="Similarity Boost" value={settings.tts.similarity_boost} onChange={(v) => updateTts("similarity_boost", Number(v))} step={0.05} />
        </div>
      </section>

      {/* YouTube */}
      <section className="card">
        <h2 className="text-sm font-semibold mb-3">YouTube Upload</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Category ID" value={settings.youtube.category_id} onChange={(v) => updateYoutube("category_id", v)} type="text" />
          <div>
            <label className="label">Default Language</label>
            <select className="select" value={settings.youtube.default_language} onChange={(e) => updateYoutube("default_language", e.target.value)}>
              <option value="en">English</option>
              <option value="tr">Turkish</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div>
            <label className="label">Privacy</label>
            <select className="select" value={settings.youtube.privacy_status} onChange={(e) => updateYoutube("privacy_status", e.target.value)}>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={settings.youtube.made_for_kids} onChange={(e) => updateYoutube("made_for_kids", e.target.checked)} className="accent-[var(--gold)]" />
              Made for Kids
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "number", step }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
      />
    </div>
  );
}

function ChannelManager({ channels, niches, onSave, saving }: {
  channels: ChannelsMap; niches: Record<string, Niche>; onSave: (c: ChannelsMap) => void; saving: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const keys = Object.keys(channels);

  function removeChannel(key: string) {
    if (!confirm(`Remove channel "${channels[key].name}"?`)) return;
    const next = { ...channels };
    delete next[key];
    onSave(next);
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Channels ({keys.length})</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(true)} disabled={addOpen}>+ Add Channel</button>
      </div>

      {addOpen && (
        <ChannelForm
          niches={niches}
          onSave={(key, ch) => { onSave({ ...channels, [key]: ch }); setAddOpen(false); }}
          onCancel={() => setAddOpen(false)}
          saving={saving}
        />
      )}

      <div className="space-y-2">
        {keys.map((k) => {
          const ch = channels[k];
          if (editKey === k) {
            return (
              <ChannelForm
                key={k}
                initial={{ key: k, channel: ch }}
                niches={niches}
                onSave={(key, updated) => { onSave({ ...channels, [key]: updated }); setEditKey(null); }}
                onCancel={() => setEditKey(null)}
                saving={saving}
              />
            );
          }
          return (
            <div key={k} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: ch.palette?.accent || "var(--gold)", color: ch.palette?.primary || "var(--navy)" }}
                >
                  {ch.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <div className="text-sm font-medium">{ch.name}</div>
                  <div className="text-[0.7rem]" style={{ color: "var(--text-muted)" }}>
                    {ch.active_niches.length} niches · {ch.default_language} · {ch.active ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditKey(k)}>Edit</button>
                {keys.length > 1 && (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => removeChannel(k)}>Remove</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChannelForm({ initial, niches, onSave, onCancel, saving }: {
  initial?: { key: string; channel: Channel };
  niches: Record<string, Niche>;
  onSave: (key: string, ch: Channel) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [key, setKey] = useState(initial?.key || "");
  const [name, setName] = useState(initial?.channel.name || "");
  const [desc, setDesc] = useState(initial?.channel.description || "");
  const [lang, setLang] = useState(initial?.channel.default_language || "en");
  const [accent, setAccent] = useState(initial?.channel.palette?.accent || "#C9A84C");
  const [primary, setPrimary] = useState(initial?.channel.palette?.primary || "#0A1628");
  const [selectedNiches, setSelectedNiches] = useState<string[]>(initial?.channel.active_niches || []);
  const [voiceShort, setVoiceShort] = useState(initial?.channel.voice_short || "");
  const [voiceLong, setVoiceLong] = useState(initial?.channel.voice_long || "");
  const [active, setActive] = useState(initial?.channel.active ?? true);

  function toggleNiche(n: string) {
    setSelectedNiches((prev) => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = key || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug || !name.trim()) return;
    onSave(slug, {
      name: name.trim(),
      description: desc.trim(),
      active_niches: selectedNiches,
      youtube_secret: initial?.channel.youtube_secret || "YOUTUBE_TOKEN_JSON",
      voice_short: voiceShort,
      voice_long: voiceLong,
      palette: { primary, accent },
      category_id: initial?.channel.category_id || "27",
      default_language: lang,
      active,
    });
  }

  return (
    <form onSubmit={submit} className="p-3 rounded-lg border border-[var(--gold)] bg-[var(--bg)] space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Channel Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Channel" />
        </div>
        <div>
          <label className="label">Language</label>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="tr">Turkish</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Channel tagline" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Voice ID (Short)</label>
          <input className="input" value={voiceShort} onChange={(e) => setVoiceShort(e.target.value)} placeholder="ElevenLabs voice ID" />
        </div>
        <div>
          <label className="label">Voice ID (Long)</label>
          <input className="input" value={voiceLong} onChange={(e) => setVoiceLong(e.target.value)} placeholder="ElevenLabs voice ID" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Primary Color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
            <input className="input" value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Accent Color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
            <input className="input" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label className="label">Niches</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(niches).map(([k, n]) => {
            const sel = selectedNiches.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleNiche(k)}
                className="badge cursor-pointer transition-colors"
                style={{
                  background: sel ? n.color + "33" : "var(--border)",
                  color: sel ? n.color : "var(--text-muted)",
                  border: sel ? `1px solid ${n.color}` : "1px solid transparent",
                }}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--gold)]" />
          Active
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim()}>
          {saving ? <Spinner /> : initial ? "Update" : "Add Channel"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
