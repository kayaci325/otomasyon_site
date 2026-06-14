import { NextResponse } from "next/server";
import { triggerWorkflow, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const { format, niche, topic, upload } = body;
  if (format !== "short" && format !== "long") {
    return NextResponse.json({ error: "format must be 'short' or 'long'" }, { status: 400 });
  }
  try {
    // Inputs must exactly match the workflow_dispatch schema (no extra keys,
    // or GitHub rejects the dispatch with 422).
    await triggerWorkflow({
      format,
      niche: niche || "psychology",
      topic: topic || "",
      upload: upload ? "true" : "false",
    });
    return NextResponse.json({ ok: true, message: "Workflow triggered" });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
  }
}
