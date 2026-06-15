"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarConfig, Niche, UpcomingSlot } from "@/lib/types";
import { getUpcomingSlots } from "@/lib/calendar-utils";
import { apiFetch, ErrorState, PageSkeleton, FormatBadge, NicheBadge, EmptyState } from "@/components/ui";
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

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!calendar) return null;

  function SlotChip({ slot, i }: { slot: CalendarConfig["weekly_plan"][number]; i: number }) {
    const s = formatStyle(slot.format);
    const info = slot.niche ? niches[slot.niche] : null;
    return (
      <div key={i} className="rounded px-1.5 py-1 mb-1 text-[0.7rem]" style={{ background: s.bg, color: s.fg }}>
        <div className="font-semibold">{slot.hour}:00</div>
        <div>{s.label}</div>
        <div className="truncate">{info ? info.label : "rotation"}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold)" }}>Content Calendar</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Recurring weekly template · {calendar.weekly_plan.length} slots/week · times in UTC</p>
      </header>

      {/* Weekly template — grid on desktop, stacked list on mobile */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Weekly Template</h2>

        <div className="hidden md:grid grid-cols-7 gap-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium py-2" style={{ color: "var(--text-muted)" }}>{d}</div>
          ))}
          {DAYS.map((_, dayIdx) => {
            const daySlots = calendar.weekly_plan.filter((s) => s.weekday === dayIdx);
            return (
              <div key={dayIdx} className="min-h-[80px] rounded-lg p-1.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {daySlots.map((slot, i) => <SlotChip key={i} slot={slot} i={i} />)}
                {daySlots.length === 0 && <div className="text-[0.625rem] text-center py-3" style={{ color: "var(--text-muted)" }}>—</div>}
              </div>
            );
          })}
        </div>

        <div className="md:hidden space-y-2">
          {DAYS_FULL.map((d, dayIdx) => {
            const daySlots = calendar.weekly_plan.filter((s) => s.weekday === dayIdx);
            if (daySlots.length === 0) return null;
            return (
              <div key={dayIdx} className="card">
                <div className="text-sm font-semibold mb-2">{d}</div>
                <div className="space-y-1.5">
                  {daySlots.map((slot, i) => {
                    const info = slot.niche ? niches[slot.niche] : null;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{String(slot.hour).padStart(2, "0")}:00</span>
                        <FormatBadge format={slot.format} />
                        <NicheBadge label={info ? info.label : "rotation"} color={info?.color} />
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
