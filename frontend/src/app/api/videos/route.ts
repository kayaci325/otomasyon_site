import { NextResponse } from "next/server";
import { listWorkflowRuns, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const runs = await listWorkflowRuns(30);
    const videos = runs.map((r: Record<string, unknown>) => ({
      id: r.id,
      run_number: r.run_number,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      html_url: r.html_url,
      event: r.event,
    }));
    return NextResponse.json({ videos });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
  }
}
