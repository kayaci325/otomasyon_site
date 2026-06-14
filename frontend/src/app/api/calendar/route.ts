import { NextResponse } from "next/server";
import { getFileContent, writeFileFresh, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/calendar.json";

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const { content, sha } = await getFileContent(PATH);
    return NextResponse.json({ ...JSON.parse(content), sha });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const { calendar } = body;
  if (!calendar || typeof calendar !== "object") {
    return NextResponse.json({ error: "calendar required" }, { status: 400 });
  }
  try {
    await writeFileFresh(PATH, JSON.stringify(calendar, null, 2), "Update calendar");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
