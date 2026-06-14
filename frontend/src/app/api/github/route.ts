import { NextResponse } from "next/server";
import { getFileContent, writeFileFresh, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set([
  "config/niches.json",
  "config/channels.json",
  "config/settings.json",
  "config/calendar.json",
  "config/ideas.json",
  "config/performance.json",
  "config/decisions.json",
]);

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (!ALLOWED.has(path)) return NextResponse.json({ error: "path not allowed" }, { status: 403 });
  try {
    const { content, sha } = await getFileContent(path);
    return NextResponse.json({ content, sha });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const { path, content, message } = body;
  if (!path || typeof content !== "string") {
    return NextResponse.json({ error: "path and content required" }, { status: 400 });
  }
  if (!ALLOWED.has(path)) return NextResponse.json({ error: "path not allowed" }, { status: 403 });
  try {
    await writeFileFresh(path, content, message || `Update ${path}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
