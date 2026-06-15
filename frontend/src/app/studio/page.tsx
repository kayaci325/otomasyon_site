"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { VideoProject, Scene, Niche } from "@/lib/types";
import { apiFetch, useToast, ErrorState, PageSkeleton, EmptyState, FormatBadge, NicheBadge, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { fmtDate } from "@/lib/format";

const TRANSITIONS = [
  { key: "cut", label: "Cut" },
  { key: "fade", label: "Fade" },
  { key: "dissolve", label: "Dissolve" },
  { key: "slide", label: "Slide" },
  { key: "zoom", label: "Zoom" },
] as const;

export default function StudioPage() {
  const { activeId } = useChannel();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [studio, nichesRaw] = await Promise.all([
        apiFetch<{ projects: VideoProject[] }>("/api/studio"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      setProjects(studio.projects || []);
      setNiches(JSON.parse(nichesRaw.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton rows={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const editingProject = editingId ? projects.find(p => p.id === editingId) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Video Studio</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Plan every detail or let the system handle it. You control the final result.
        </p>
      </header>

      {editingProject ? (
        <SceneEditor
          project={editingProject}
          niches={niches}
          onBack={() => { setEditingId(null); load(); }}
          toast={toast}
        />
      ) : (
        <>
          <CreateProject niches={niches} onCreated={(id) => { load().then(() => setEditingId(id)); }} toast={toast} />
          <ProjectList projects={projects} niches={niches} onEdit={setEditingId} onChanged={load} toast={toast} />
        </>
      )}
    </div>
  );
}

/* -------- create project -------- */
function CreateProject({ niches, onCreated, toast }: { niches: Record<string, Niche>; onCreated: (id: string) => void; toast: ReturnType<typeof useToast> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"quick" | "manual">("quick");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"short" | "long">("short");
  const [niche, setNiche] = useState(Object.keys(niches)[0] || "");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("30");
  const [sceneCount, setSceneCount] = useState("5");
  const [transition, setTransition] = useState("fade");

  const presets = format === "short"
    ? [{ label: "15s (Ultra Short)", dur: 15, scenes: 3 }, { label: "30s (Standard)", dur: 30, scenes: 5 }, { label: "60s (Max Short)", dur: 60, scenes: 8 }]
    : [{ label: "3 min", dur: 180, scenes: 12 }, { label: "8 min", dur: 480, scenes: 20 }, { label: "12 min", dur: 720, scenes: 30 }];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean }>("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          mode,
          format,
          niche,
          topic: topic.trim(),
          total_duration_seconds: Number(duration) || 30,
          scene_count: Number(sceneCount) || 5,
          default_transition: transition,
        }),
      });
      toast.success("Project created");
      const projects = await apiFetch<{ projects: VideoProject[] }>("/api/studio");
      const newest = projects.projects[0];
      setTitle(""); setTopic(""); setOpen(false);
      onCreated(newest?.id || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + New Video Project
      </button>
    );
  }

  return (
    <form onSubmit={create} className="card space-y-4" style={{ borderColor: "var(--gold)" }}>
      <h2 className="text-lg font-semibold">New Video Project</h2>

      {/* Mode selector */}
      <div>
        <label className="label">Production Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`p-3 rounded-lg border text-left text-sm ${mode === "quick" ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--border)]"}`} onClick={() => setMode("quick")}>
            <div className="font-semibold">Quick Setup</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Set parameters, system generates scenes</div>
          </button>
          <button type="button" className={`p-3 rounded-lg border text-left text-sm ${mode === "manual" ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--border)]"}`} onClick={() => setMode("manual")}>
            <div className="font-semibold">Scene by Scene</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Full control: plan every scene individually</div>
          </button>
        </div>
      </div>

      <input className="input" placeholder="Project title" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Format</label>
          <div className="flex gap-2">
            {(["short", "long"] as const).map(f => (
              <button key={f} type="button" className={`btn btn-sm flex-1 ${format === f ? "btn-primary" : "btn-secondary"}`} onClick={() => { setFormat(f); setDuration(f === "short" ? "30" : "480"); setSceneCount(f === "short" ? "5" : "20"); }}>
                {f === "short" ? "Short" : "Long"}
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
          <label className="label">Topic</label>
          <input className="input" placeholder="Video topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
      </div>

      {/* Duration & Scene presets */}
      <div>
        <label className="label">Quick Presets</label>
        <div className="flex gap-2 flex-wrap">
          {presets.map(p => (
            <button key={p.dur} type="button" className={`btn btn-sm ${Number(duration) === p.dur ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { setDuration(String(p.dur)); setSceneCount(String(p.scenes)); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Duration (sec)</label>
          <input className="input" type="number" min={5} max={3600} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="label">Scene Count</label>
          <input className="input" type="number" min={1} max={50} value={sceneCount} onChange={(e) => setSceneCount(e.target.value)} />
        </div>
        <div>
          <label className="label">Default Transition</label>
          <select className="select" value={transition} onChange={(e) => setTransition(e.target.value)}>
            {TRANSITIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-lg p-3 text-xs" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
        {Number(sceneCount) > 0 && Number(duration) > 0 && (
          <span>~{(Number(duration) / Number(sceneCount)).toFixed(1)}s per scene · {Number(sceneCount)} scenes · {Number(duration)}s total</span>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
          {saving ? <Spinner /> : mode === "manual" ? "Create & Edit Scenes" : "Create Project"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/* -------- project list -------- */
function ProjectList({ projects, niches, onEdit, onChanged, toast }: {
  projects: VideoProject[]; niches: Record<string, Niche>;
  onEdit: (id: string) => void; onChanged: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const sorted = useMemo(() => [...projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [projects]);

  async function del(id: string) {
    if (!confirm("Delete this project?")) return;
    try {
      await apiFetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      onChanged(); toast.success("Project deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const statusStyle = (s: string) => s === "done" ? { bg: "var(--success)22", fg: "var(--success)" } : s === "producing" ? { bg: "var(--warning)22", fg: "var(--warning)" } : { bg: "var(--border)", fg: "var(--text-muted)" };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Projects ({projects.length})</h2>
      {sorted.length === 0 ? (
        <div className="card"><EmptyState title="No projects yet" hint="Create your first video project above." icon="🎬" /></div>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const ss = statusStyle(p.status);
            const nicheInfo = p.niche ? niches[p.niche] : null;
            const filled = p.scenes.filter(s => s.text || s.image_url || s.image_prompt).length;
            return (
              <div key={p.id} className="card flex items-start justify-between gap-3">
                <button className="flex-1 text-left min-w-0" onClick={() => onEdit(p.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{p.title}</span>
                    <FormatBadge format={p.format} />
                    {nicheInfo && <NicheBadge label={nicheInfo.label} color={nicheInfo.color} />}
                    <span className="badge" style={{ background: ss.bg, color: ss.fg }}>{p.status}</span>
                    <span className="badge" style={{ background: "var(--border)", color: "var(--text-muted)" }}>{p.mode === "manual" ? "Manual" : "Quick"}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {p.scene_count} scenes · {p.total_duration_seconds}s · {filled}/{p.scene_count} filled · {fmtDate(p.created_at)}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn btn-secondary btn-sm" onClick={() => onEdit(p.id)}>Edit</button>
                  <button className="icon-btn" style={{ color: "var(--error)" }} onClick={() => del(p.id)} aria-label="Delete">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* -------- scene editor -------- */
function SceneEditor({ project, niches, onBack, toast }: {
  project: VideoProject; niches: Record<string, Niche>;
  onBack: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [scenes, setScenes] = useState(project.scenes);
  const [saving, setSaving] = useState<string | null>(null);

  const totalDuration = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);
  const filled = scenes.filter(s => s.text || s.image_url || s.image_prompt).length;

  async function updateScene(sceneId: string, updates: Record<string, unknown>) {
    setSaving(sceneId);
    try {
      await apiFetch("/api/studio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_scene", project_id: project.id, scene_id: sceneId, ...updates }),
      });
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } as Scene : s));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setSaving(null);
  }

  async function addScene() {
    try {
      await apiFetch("/api/studio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_scene", project_id: project.id, duration_seconds: 5 }),
      });
      const data = await apiFetch<{ projects: VideoProject[] }>("/api/studio");
      const updated = data.projects.find(p => p.id === project.id);
      if (updated) setScenes(updated.scenes);
      toast.success("Scene added");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function removeScene(sceneId: string) {
    if (scenes.length <= 1) return;
    try {
      await apiFetch("/api/studio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_scene", project_id: project.id, scene_id: sceneId }),
      });
      setScenes(prev => {
        const next = prev.filter(s => s.id !== sceneId);
        next.forEach((s, i) => { s.order = i + 1; });
        return next;
      });
      toast.success("Scene removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function moveScene(sceneId: string, dir: -1 | 1) {
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= scenes.length) return;
    const next = [...scenes];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    next.forEach((s, i) => { s.order = i + 1; });
    setScenes(next);
    try {
      await apiFetch("/api/studio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder_scenes", project_id: project.id, scene_ids: next.map(s => s.id) }),
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button className="text-xs mb-1 flex items-center gap-1" style={{ color: "var(--gold)" }} onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Projects
          </button>
          <h2 className="text-lg font-semibold">{project.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <FormatBadge format={project.format} />
            {project.niche && niches[project.niche] && <NicheBadge label={niches[project.niche].label} color={niches[project.niche].color} />}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {scenes.length} scenes · {totalDuration}s total · {filled}/{scenes.length} filled
            </span>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addScene}>+ Add Scene</button>
      </div>

      {/* Timeline overview */}
      <div className="card">
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
          {scenes.map(s => (
            <div
              key={s.id}
              className="h-full transition-all"
              style={{
                flex: s.duration_seconds,
                background: (s.text || s.image_url || s.image_prompt) ? "var(--gold)" : "var(--border)",
              }}
              title={`Scene ${s.order}: ${s.duration_seconds}s`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[0.65rem] mt-1" style={{ color: "var(--text-muted)" }}>
          <span>0:00</span>
          <span>{Math.floor(totalDuration / 60)}:{String(totalDuration % 60).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Scene cards */}
      <div className="space-y-3">
        {scenes.map((scene, idx) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={idx}
            total={scenes.length}
            saving={saving === scene.id}
            onUpdate={(u) => updateScene(scene.id, u)}
            onRemove={() => removeScene(scene.id)}
            onMove={(dir) => moveScene(scene.id, dir)}
          />
        ))}
      </div>
    </div>
  );
}

/* -------- single scene card -------- */
function SceneCard({ scene, index, total, saving, onUpdate, onRemove, onMove }: {
  scene: Scene; index: number; total: number; saving: boolean;
  onUpdate: (u: Record<string, unknown>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFilled = !!(scene.text || scene.image_url || scene.image_prompt);

  return (
    <div className="card" style={{ borderColor: isFilled ? "var(--gold)44" : "var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: isFilled ? "var(--gold)22" : "var(--border)", color: isFilled ? "var(--gold)" : "var(--text-muted)" }}>
            {scene.order}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">Scene {scene.order} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>· {scene.duration_seconds}s · {scene.transition}</span></div>
            {scene.text && <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{scene.text}</div>}
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {saving && <Spinner size={14} />}
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up" style={{ color: "var(--text-muted)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down" style={{ color: "var(--text-muted)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {total > 1 && (
            <button className="icon-btn" onClick={onRemove} aria-label="Remove scene" style={{ color: "var(--error)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-[var(--border)]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duration (seconds)</label>
              <input className="input" type="number" min={1} max={300} defaultValue={scene.duration_seconds}
                onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== scene.duration_seconds) onUpdate({ duration_seconds: v }); }} />
            </div>
            <div>
              <label className="label">Transition</label>
              <select className="select" defaultValue={scene.transition}
                onChange={(e) => onUpdate({ transition: e.target.value })}>
                {TRANSITIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Script / Narration</label>
            <textarea className="textarea" rows={3} placeholder="What should be said during this scene..."
              defaultValue={scene.text}
              onBlur={(e) => { if (e.target.value !== scene.text) onUpdate({ text: e.target.value }); }} />
          </div>

          <div>
            <label className="label">Image</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <input className="input" placeholder="Image URL (paste link or upload URL)"
                  defaultValue={scene.image_url}
                  onBlur={(e) => { if (e.target.value !== scene.image_url) onUpdate({ image_url: e.target.value }); }} />
                <p className="text-[0.65rem] mt-0.5" style={{ color: "var(--text-muted)" }}>Direct link to an image</p>
              </div>
              <div>
                <input className="input" placeholder="AI image prompt (for auto-generation)"
                  defaultValue={scene.image_prompt}
                  onBlur={(e) => { if (e.target.value !== scene.image_prompt) onUpdate({ image_prompt: e.target.value }); }} />
                <p className="text-[0.65rem] mt-0.5" style={{ color: "var(--text-muted)" }}>Or describe the image for AI generation</p>
              </div>
            </div>
          </div>

          {scene.image_url && (
            <div className="rounded-lg overflow-hidden border border-[var(--border)]" style={{ maxHeight: 200 }}>
              <img src={scene.image_url} alt={`Scene ${scene.order}`} className="w-full h-full object-cover" style={{ maxHeight: 200 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
