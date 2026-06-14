import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";
import type { PerformanceData, VideoPerf } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/performance.json";

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<PerformanceData>(PATH, { videos: [] });
    return NextResponse.json({ videos: data.videos || [] });
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
  if (!["add", "update", "delete"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (action === "add" && (typeof body.title !== "string" || !body.title.trim())) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    await updateJsonFile<PerformanceData>(
      PATH,
      (data) => {
        if (!Array.isArray(data.videos)) data.videos = [];
        if (action === "add") {
          const v: VideoPerf = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title: String(body.title).trim(),
            youtube_url: body.youtube_url || "",
            niche: body.niche || null,
            format: body.format === "long" ? "long" : "short",
            hook: body.hook || null,
            published_at: body.published_at || new Date().toISOString().slice(0, 10),
            views: num(body.views),
            ctr: num(body.ctr),
            retention: num(body.retention),
            apv: num(body.apv),
            subs_gained: num(body.subs_gained),
            notes: body.notes || "",
          };
          data.videos.unshift(v);
        } else if (action === "delete") {
          data.videos = data.videos.filter((v) => v.id !== body.id);
        } else if (action === "update") {
          const v = data.videos.find((x) => x.id === body.id);
          if (v && body.updates && typeof body.updates === "object") {
            const u = body.updates as Record<string, unknown>;
            const allow = ["title", "youtube_url", "niche", "format", "hook", "published_at", "views", "ctr", "retention", "apv", "subs_gained", "notes"];
            const numeric = new Set(["views", "ctr", "retention", "apv", "subs_gained"]);
            for (const k of allow) if (k in u) (v as unknown as Record<string, unknown>)[k] = numeric.has(k) ? num(u[k]) : u[k];
          }
        }
        return data;
      },
      `performance: ${action}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
