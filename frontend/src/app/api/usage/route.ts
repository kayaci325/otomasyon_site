import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/usage.json";

interface UsageRecord {
  date: string;
  action: string;
  format?: string;
  niche?: string;
  cost_estimate?: number;
}

interface UsageData {
  records: UsageRecord[];
  total_videos: number;
  total_cost_estimate: number;
}

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<UsageData>(PATH, { records: [], total_videos: 0, total_cost_estimate: 0 });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = data.records.filter((r) => r.date >= monthStart);
    return NextResponse.json({
      this_month: {
        videos: thisMonth.filter((r) => r.action === "produce").length,
        cost_estimate: thisMonth.reduce((s, r) => s + (r.cost_estimate || 0), 0),
      },
      all_time: {
        total_videos: data.total_videos,
        total_cost_estimate: data.total_cost_estimate,
      },
      recent: data.records.slice(-20).reverse(),
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

  try {
    await updateJsonFile<UsageData>(
      PATH,
      (data) => {
        if (!Array.isArray(data.records)) data.records = [];
        data.records.push({
          date: new Date().toISOString(),
          action: body.action || "produce",
          format: body.format || undefined,
          niche: body.niche || undefined,
          cost_estimate: body.cost_estimate || 0.5,
        });
        if (body.action === "produce") {
          data.total_videos = (data.total_videos || 0) + 1;
        }
        data.total_cost_estimate = (data.total_cost_estimate || 0) + (body.cost_estimate || 0.5);
        return data;
      },
      "Track usage"
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
