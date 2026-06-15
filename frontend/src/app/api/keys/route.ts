import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/api-keys.json";

interface ApiKeysData {
  elevenlabs_key: string;
  openai_key: string;
  fal_key: string;
  pexels_key: string;
}

const MASK = (key: string) => key ? key.slice(0, 4) + "•".repeat(Math.max(0, key.length - 8)) + key.slice(-4) : "";

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<ApiKeysData>(PATH, {
      elevenlabs_key: "",
      openai_key: "",
      fal_key: "",
      pexels_key: "",
    });
    return NextResponse.json({
      elevenlabs_key: MASK(data.elevenlabs_key),
      openai_key: MASK(data.openai_key),
      fal_key: MASK(data.fal_key),
      pexels_key: MASK(data.pexels_key),
      has_elevenlabs: !!data.elevenlabs_key,
      has_openai: !!data.openai_key,
      has_fal: !!data.fal_key,
      has_pexels: !!data.pexels_key,
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

  const allowed = ["elevenlabs_key", "openai_key", "fal_key", "pexels_key"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === "string") {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid keys provided" }, { status: 400 });
  }

  try {
    await updateJsonFile<ApiKeysData>(
      PATH,
      (data) => {
        for (const [k, v] of Object.entries(updates)) {
          (data as unknown as Record<string, string>)[k] = v;
        }
        return data;
      },
      "Update API keys"
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
