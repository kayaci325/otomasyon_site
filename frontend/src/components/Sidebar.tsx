"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui";
import { useChannel } from "@/components/ChannelContext";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/performance", label: "Performance", icon: "M3 3v18h18M7 14l4-4 3 3 5-6" },
  { href: "/ideas", label: "Ideas", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { href: "/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/produce", label: "Produce", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/videos", label: "Runs", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const LOGOUT_ICON = "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function ChannelSwitcher() {
  const { channels, activeId, active, setActiveId } = useChannel();
  const [open, setOpen] = useState(false);
  const keys = Object.keys(channels);

  if (keys.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--bg)] transition-colors"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: active?.palette?.accent || "var(--gold)",
            color: active?.palette?.primary || "var(--navy)",
          }}
        >
          {active?.name?.charAt(0)?.toUpperCase() || "?"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{active?.name || "No channel"}</div>
          <div className="text-[0.65rem]" style={{ color: "var(--text-muted)" }}>
            {active?.active_niches?.length || 0} niches
          </div>
        </div>
        <svg className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>
      {open && keys.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl z-50 overflow-hidden">
          {keys.map((k) => {
            const ch = channels[k];
            const selected = k === activeId;
            return (
              <button
                key={k}
                onClick={() => { setActiveId(k); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${selected ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "hover:bg-[var(--bg)]"}`}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold shrink-0"
                  style={{ background: ch.palette?.accent || "var(--gold)", color: ch.palette?.primary || "var(--navy)" }}
                >
                  {ch.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
                <span className="truncate">{ch.name}</span>
                {selected && <span className="ml-auto text-[var(--gold)]">&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  if (pathname === "/login") return null;

  async function logout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {}
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--gold)" }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: "var(--gold)" }}>MindPower OS</h1>
              <p className="text-[0.6rem]" style={{ color: "var(--text-muted)" }}>Command Center</p>
            </div>
          </div>
          <ChannelSwitcher />
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
                }`}
              >
                <Icon d={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors">
            <Icon d={LOGOUT_ICON} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] z-50 flex justify-around px-1"
        style={{ paddingTop: "0.4rem", paddingBottom: "calc(0.4rem + env(safe-area-inset-bottom))" }}
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[0.6rem] ${
                active ? "text-[var(--gold)]" : "text-[var(--text-muted)]"
              }`}
            >
              <Icon d={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
