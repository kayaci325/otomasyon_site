import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";
import type { DecisionsData, WeeklyDecision } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/decisions.json";

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<DecisionsData>(PATH, { decisions: [] });
    return NextResponse.json({
      decisions: data.decisions || [],
      subscribers: data.subscribers ?? 0,
      watch_hours: data.watch_hours ?? 0,
      shorts_views_90d: data.shorts_views_90d ?? 0,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const action = body?.action;
  if (!["add", "delete", "markers"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  try {
    await updateJsonFile<DecisionsData>(
      PATH,
      (data) => {
        if (!Array.isArray(data.decisions)) data.decisions = [];
        if (action === "add") {
          const d: WeeklyDecision = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            week_of: body.week_of || new Date().toISOString().slice(0, 10),
            best_video: body.best_video || "",
            worst_video: body.worst_video || "",
            diagnosis: body.diagnosis || "",
            variable_changed: body.variable_changed || "",
            created_at: new Date().toISOString(),
          };
          data.decisions.unshift(d);
        } else if (action === "delete") {
          data.decisions = data.decisions.filter((d) => d.id !== body.id);
        } else if (action === "markers") {
          if (typeof body.subscribers === "number") data.subscribers = body.subscribers;
          if (typeof body.watch_hours === "number") data.watch_hours = body.watch_hours;
          if (typeof body.shorts_views_90d === "number") data.shorts_views_90d = body.shorts_views_90d;
        }
        return data;
      },
      `decisions: ${action}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
