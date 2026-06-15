import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;

  const encoded = readCookie(request, "mp_user");
  if (!encoded) {
    return NextResponse.json({ user: null, provider: "password" });
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    return NextResponse.json({
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        channels: payload.channels || [],
      },
      provider: "google",
    });
  } catch {
    return NextResponse.json({ user: null, provider: "password" });
  }
}
