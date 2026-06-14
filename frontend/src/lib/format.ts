/** Shared, consistent formatting + status/format colour helpers. */

export const FORMAT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  short: { bg: "#7c3aed22", fg: "#a78bfa", label: "Short" },
  long: { bg: "#05966922", fg: "#34d399", label: "Long" },
};

export function formatStyle(format: string) {
  return FORMAT_STYLE[format] || { bg: "var(--border)", fg: "var(--text-muted)", label: format };
}

export function statusColor(status: string): string {
  switch (status) {
    case "success":
      return "var(--success)";
    case "failure":
      return "var(--error)";
    case "in_progress":
    case "queued":
    case "pending":
      return "var(--warning)";
    default:
      return "var(--text-muted)";
  }
}

const STATUS_LABELS: Record<string, string> = {
  success: "Succeeded",
  failure: "Failed",
  in_progress: "In progress",
  queued: "Queued",
  pending: "Pending",
  cancelled: "Cancelled",
  skipped: "Skipped",
  startup_failure: "Startup failure",
  timed_out: "Timed out",
};

export function humanizeStatus(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDateTime(value: string | number | Date): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

export function fmtDate(value: string | number | Date): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Add alpha to a hex colour for tinted badge backgrounds. */
export function tint(hex: string, alpha = "22"): string {
  return (hex || "#6b7280") + alpha;
}
