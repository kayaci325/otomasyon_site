import type { CalendarConfig, Niche, UpcomingSlot } from "./types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_SCAN_DAYS = 90; // hard bound so we never loop forever

/** ISO week + ISO week-year (the year the ISO week belongs to). */
function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year };
}

export function resolveNiche(
  slot: { weekday: number; format: string; niche: string | null },
  planIndex: number,
  calendar: CalendarConfig,
  targetDate: Date
): string {
  if (slot.niche) return slot.niche;

  const { week: iso, year } = getISOWeek(targetDate);
  // Stable rotation key using the ISO week-year (avoids Jan-1 boundary jumps).
  const week = year * 53 + iso;

  if (slot.format === "short") {
    const shortSlots = calendar.weekly_plan
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.format === "short");
    const ordinal = shortSlots.findIndex(({ i }) => i === planIndex);
    const shortsPerWeek = shortSlots.length || 1;
    const rot = calendar.short_rotation;
    if (!rot || rot.length === 0) return "";
    return rot[((week * shortsPerWeek + ordinal) % rot.length + rot.length) % rot.length];
  }
  const rot = calendar.long_rotation;
  if (!rot || rot.length === 0) return "";
  return rot[((week % rot.length) + rot.length) % rot.length];
}

export function getUpcomingSlots(
  calendar: CalendarConfig,
  niches: Record<string, Niche>,
  count: number
): UpcomingSlot[] {
  const slots: UpcomingSlot[] = [];
  if (!calendar?.weekly_plan?.length) return slots;

  const now = new Date();
  const day = new Date(now);
  let scanned = 0;

  while (slots.length < count && scanned < MAX_SCAN_DAYS) {
    const wd = (day.getUTCDay() + 6) % 7; // JS Sunday=0 -> Mon=0
    for (let i = 0; i < calendar.weekly_plan.length; i++) {
      const plan = calendar.weekly_plan[i];
      if (plan.weekday !== wd) continue;
      const publishAt = new Date(day);
      publishAt.setUTCHours(plan.hour, 0, 0, 0);
      if (publishAt <= now) continue;

      const niche = resolveNiche(plan, i, calendar, day);
      const nicheInfo = niches[niche];
      slots.push({
        publish_at: publishAt.toISOString(),
        format: plan.format as "short" | "long",
        niche,
        niche_label: nicheInfo?.label || niche || "Rotation",
        niche_color: nicheInfo?.color || "#6b7280",
        day_label: `${DAY_NAMES[wd]} ${plan.hour}:00 UTC`,
      });
    }
    day.setUTCDate(day.getUTCDate() + 1);
    scanned++;
  }

  slots.sort((a, b) => new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime());
  return slots.slice(0, count);
}
