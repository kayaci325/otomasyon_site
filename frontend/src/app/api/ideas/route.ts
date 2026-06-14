import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/ideas.json";
type IdeasFile = { ideas: Idea[] };

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<IdeasFile>(PATH, { ideas: [] });
    return NextResponse.json({ ideas: data.ideas || [] });
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
  if (!["add", "delete", "star", "update"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (action === "add" && (typeof body.text !== "string" || !body.text.trim())) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  try {
    await updateJsonFile<IdeasFile>(
      PATH,
      (data) => {
        if (!Array.isArray(data.ideas)) data.ideas = [];
        if (action === "add") {
          data.ideas.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            text: String(body.text).trim(),
            niche: body.niche || null,
            format: body.format || null,
            hook: body.hook || null,
            created_at: new Date().toISOString(),
            starred: false,
            status: "inbox",
          });
        } else if (action === "delete") {
          data.ideas = data.ideas.filter((i) => i.id !== body.id);
        } else if (action === "star") {
          const idea = data.ideas.find((i) => i.id === body.id);
          if (idea) idea.starred = !idea.starred;
        } else if (action === "update") {
          const idea = data.ideas.find((i) => i.id === body.id);
          if (idea && body.updates && typeof body.updates === "object") {
            const allow = ["text", "niche", "format", "hook", "starred", "status"];
            for (const k of allow) if (k in body.updates) (idea as unknown as Record<string, unknown>)[k] = (body.updates as Record<string, unknown>)[k];
          }
        }
        return data;
      },
      `ideas: ${action}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
