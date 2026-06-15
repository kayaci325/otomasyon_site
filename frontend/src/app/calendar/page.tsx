"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarConfig, CalendarSlot, Niche, UpcomingSlot } from "@/lib/types";
import { getUpcomingSlots } from "@/lib/calendar-utils";
import { apiFetch, useToast, ErrorState, PageSkeleton, FormatBadge, NicheBadge, EmptyState, Spinner } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";
import { formatStyle, fmtDateTime } from "@/lib/format";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function CalendarPage() {
  const { activeId } = useChannel();
  const [calendar, setCalendar] = useState<CalendarConfig | null>(null);
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [upcoming, setUpcoming] = useState<UpcomingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSlot, setNewSlot] = useState({ weekday: 0, hour: 12, format: "short" as "short" | "long", niche: "" });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cal, nichesRaw] = await Promise.all([
        apiFetch<CalendarConfig>("/api/calendar"),
        apiFetch<{ content: string }>("/api/github?path=config/niches.json"),
      ]);
      const n: Record<string, Niche> = JSON.parse(nichesRaw.content);
      setCalendar(cal);
      setNiches(n);
      setUpcoming(getUpcomingSlots(cal, n, 14));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  async function saveCalendar(updated: CalendarConfig) {
    setSaving(true);
    try {
      await apiFetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar: updated }),
      });
      setCalendar(updated);
      setUpcoming(getUpcomingSlots(updated, niches, 14));
      toast.success("Calendar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!calendar) return;
    const slot: CalendarSlot = {
      weekday: newSlot.weekday,
      hour: newSlot.hour,
      format: newSlot.format,
      niche: newSlot.niche || null,
      label: `${DAYS_FULL[newSlot.weekday]} ${newSlot.hour}:00`,
    };
    const updated = { ...calendar, weekly_plan: [...calendar.weekly_plan, slot] };
    await saveCalendar(updated);
    setAddOpen(false);
    setNewSlot({ weekday: 0, hour: 12, format: "short", niche: "" });
  }

  async function removeSlot(idx: number) {
    if (!calendar) return;
    const updated = { ...calendar, weekly_plan: calendar.weekly_plan.filter((_, i) => i !== idx) };
    await saveCalendar(updated);
  }

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!calendar) return null;

  function SlotChip({ slot, i, globalIdx }: { slot: CalendarConfig["weekly_plan"][number]; i: number; globalIdx: number }) {
    const s = formatStyle(slot.format);
    const info = slot.niche ? niches[slot.niche] : null;
    return (
      <div key={i} className="rounded px-1.5 py-1 mb-1 text-[0.7rem] group relative" style={{ background: s.bg, color: s.fg }}>
        <button
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => removeSlot(globalIdx)}
          aria-label="Remove slot"
          style={{ color: s.fg }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="font-semibold">{slot.hour}:00</div>
        <div>{s.label}</div>
        <div className="truncate">{info ? info.label : "rotation"}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Content Calendar</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Recurring weekly template · {calendar.weekly_plan.length} slots/week · times in UTC</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(!addOpen)}>
          {addOpen ? "Cancel" : "+ Add Slot"}
        </button>
      </header>

      {addOpen && (
        <form onSubmit={addSlot} className="card space-y-3" style={{ borderColor: "var(--gold)" }}>
          <h3 className="text-sm font-semibold">New Weekly Slot</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Day</label>
              <select className="select" value={newSlot.weekday} onChange={(e) => setNewSlot(s => ({ ...s, weekday: Number(e.target.value) }))}>
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hour (UTC)</label>
              <select className="select" value={newSlot.hour} onChange={(e) => setNewSlot(s => ({ ...s, hour: Number(e.target.value) }))}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="label">Format</label>
              <div className="flex gap-2">
                {(["short", "long"] as const).map(f => (
                  <button key={f} type="button" className={`btn btn-sm flex-1 ${newSlot.format === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setNewSlot(s => ({ ...s, format: f }))}>
                    {f === "short" ? "Short" : "Long"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Niche</label>
              <select className="select" value={newSlot.niche} onChange={(e) => setNewSlot(s => ({ ...s, niche: e.target.value }))}>
                <option value="">Rotation</option>
                {Object.entries(niches).map(([k, n]) => <option key={k} value={k}>{n.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <Spinner /> : "Add Slot"}
          </button>
        </form>
      )}

      {/* Weekly template — grid on desktop, stacked list on mobile */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Weekly Template</h2>

        <div className="hidden md:grid grid-cols-7 gap-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium py-2" style={{ color: "var(--text-muted)" }}>{d}</div>
          ))}
          {DAYS.map((_, dayIdx) => {
            const daySlots = calendar.weekly_plan
              .map((s, idx) => ({ ...s, _idx: idx }))
              .filter((s) => s.weekday === dayIdx);
            return (
              <div key={dayIdx} className="min-h-[80px] rounded-lg p-1.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {daySlots.map((slot, i) => <SlotChip key={slot._idx} slot={slot} i={i} globalIdx={slot._idx} />)}
                {daySlots.length === 0 && <div className="text-[0.625rem] text-center py-3" style={{ color: "var(--text-muted)" }}>—</div>}
              </div>
            );
          })}
        </div>

        <div className="md:hidden space-y-2">
          {DAYS_FULL.map((d, dayIdx) => {
            const daySlots = calendar.weekly_plan
              .map((s, idx) => ({ ...s, _idx: idx }))
              .filter((s) => s.weekday === dayIdx);
            if (daySlots.length === 0) return null;
            return (
              <div key={dayIdx} className="card">
                <div className="text-sm font-semibold mb-2">{d}</div>
                <div className="space-y-1.5">
                  {daySlots.map((slot) => {
                    const info = slot.niche ? niches[slot.niche] : null;
                    return (
                      <div key={slot._idx} className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{String(slot.hour).padStart(2, "0")}:00</span>
                        <FormatBadge format={slot.format} />
                        <NicheBadge label={info ? info.label : "rotation"} color={info?.color} />
                        <button className="icon-btn ml-auto" style={{ color: "var(--error)" }} aria-label="Remove slot" onClick={() => removeSlot(slot._idx)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Niche rotations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Niche Rotations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-2" style={{ color: "#a78bfa" }}>Short Rotation ({calendar.short_rotation.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {calendar.short_rotation.map((key) => <NicheBadge key={key} label={niches[key]?.label || key} color={niches[key]?.color} />)}
            </div>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-2" style={{ color: "#34d399" }}>Long Rotation ({calendar.long_rotation.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {calendar.long_rotation.map((key) => <NicheBadge key={key} label={niches[key]?.label || key} color={niches[key]?.color} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Next 14 slots */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Next 14 Slots</h2>
        <div className="space-y-2">
          {upcoming.length === 0 && <div className="card"><EmptyState title="No upcoming slots" hint="Add entries to your weekly plan." icon="🗓" /></div>}
          {upcoming.map((slot, i) => {
            const dt = new Date(slot.publish_at);
            const isToday = new Date().toDateString() === dt.toDateString();
            return (
              <div key={i} className="card flex items-center justify-between" style={isToday ? { borderColor: "var(--gold)" } : {}}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <FormatBadge format={slot.format} />
                  <NicheBadge label={slot.niche_label} color={slot.niche_color} />
                  {isToday && <span className="badge" style={{ background: "var(--gold)33", color: "var(--gold)" }}>TODAY</span>}
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{fmtDateTime(slot.publish_at)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
