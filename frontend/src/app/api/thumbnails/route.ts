import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";
import type { ThumbnailPlan, ThumbnailVariant } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/thumbnails.json";

interface ThumbnailsData {
  plans: ThumbnailPlan[];
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
    const data = await readJsonFile<ThumbnailsData>(PATH, { plans: [] });
    return NextResponse.json({ plans: data.plans || [] });
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
  if (!["add", "delete", "update_variant", "set_winner"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  try {
    await updateJsonFile<ThumbnailsData>(
      PATH,
      (data) => {
        if (!Array.isArray(data.plans)) data.plans = [];

        if (action === "add") {
          if (!body.title?.trim()) throw new Error("title required");
          const variants: ThumbnailVariant[] = (body.variants || []).map((v: Partial<ThumbnailVariant>) => ({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            prompt: v.prompt || "",
            style: v.style || "dark_moody",
            notes: v.notes || "",
            winner: false,
          }));
          const plan: ThumbnailPlan = {
            video_id: body.video_id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title: String(body.title).trim(),
            niche: body.niche || "",
            variants,
            created_at: new Date().toISOString(),
          };
          data.plans.unshift(plan);
        } else if (action === "delete") {
          data.plans = data.plans.filter((p) => p.video_id !== body.video_id);
        } else if (action === "update_variant") {
          const plan = data.plans.find((p) => p.video_id === body.video_id);
          if (plan) {
            const v = plan.variants.find((x) => x.id === body.variant_id);
            if (v) {
              if (body.notes !== undefined) v.notes = body.notes;
              if (body.prompt !== undefined) v.prompt = body.prompt;
            }
          }
        } else if (action === "set_winner") {
          const plan = data.plans.find((p) => p.video_id === body.video_id);
          if (plan) {
            plan.variants.forEach((v) => { v.winner = v.id === body.variant_id; });
          }
        }
        return data;
      },
      `thumbnails: ${action}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
