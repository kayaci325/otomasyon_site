"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { formatStyle, statusColor, humanizeStatus, tint } from "@/lib/format";

/* ---------------------------------- fetch ---------------------------------- */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Authenticated fetch: redirects to /login on 401, throws ApiError on failure. */
export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Session expired");
  }
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (body && typeof body === "object" && "error" in body) {
      msg = String((body as { error: unknown }).error);
    } else if (typeof body === "string" && body) {
      msg = body;
    }
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

/* ---------------------------------- toasts --------------------------------- */

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}
interface ToastApi {
  toast: (message: string, kind?: ToastKind, action?: Toast["action"]) => void;
  success: (m: string) => void;
  error: (m: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastApi["toast"]>((message, kind = "info", action) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message, action }]);
    setTimeout(() => remove(id), action ? 7000 : 4000);
  }, [remove]);

  const api: ToastApi = {
    toast,
    success: (m) => toast(m, "success"),
    error: (m) => toast(m, "error"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.onClick();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* --------------------------------- states ---------------------------------- */

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse" aria-hidden="true">
      <div className="h-8 w-48 rounded skeleton-block" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card h-16" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="max-w-md mx-auto text-center py-16 px-4" role="alert">
      <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
      <h2 className="text-lg font-semibold mb-1">Couldn&apos;t load this page</h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{message}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon = "✨",
  action,
}: {
  title: string;
  hint?: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-3xl mb-2" aria-hidden="true">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------- badges ---------------------------------- */

export function FormatBadge({ format }: { format: string }) {
  const s = formatStyle(format);
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function NicheBadge({ label, color }: { label: string; color?: string }) {
  const c = color || "#6b7280";
  return (
    <span className="badge" style={{ background: tint(c), color: c }}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span className="badge" style={{ background: tint(c), color: c }}>
      {humanizeStatus(status)}
    </span>
  );
}

export function StatusDot({ status, label }: { status: string; label?: string }) {
  const c = statusColor(status);
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: c }}
      role="img"
      aria-label={label || humanizeStatus(status)}
      title={label || humanizeStatus(status)}
    />
  );
}

/* --------------------------------- switch ---------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="switch"
      data-on={checked}
    >
      <span className="switch-thumb" />
    </button>
  );
}
