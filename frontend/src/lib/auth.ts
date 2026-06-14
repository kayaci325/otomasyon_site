import { NextResponse } from "next/server";

/**
 * Single-admin auth. The session cookie stores an opaque HMAC token derived
 * from ADMIN_PASSWORD (never the password itself). Uses Web Crypto so the same
 * code runs in both the Edge middleware and Node route handlers.
 */
export const SESSION_COOKIE = "mp_session";
const SESSION_MESSAGE = "mp_session_v1";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison (equal-length hex strings). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The opaque token stored in the session cookie. */
export async function sessionToken(): Promise<string> {
  return hmacHex(adminPassword(), SESSION_MESSAGE);
}

/** Verify a submitted login password without leaking timing. */
export async function verifyPassword(submitted: string): Promise<boolean> {
  const secret = adminPassword();
  if (!secret) return false;
  const a = await hmacHex(secret, submitted ?? "");
  const b = await hmacHex(secret, secret);
  return timingSafeEqual(a, b);
}

/** Verify a session-cookie token value. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !adminPassword()) return false;
  return timingSafeEqual(token, await sessionToken());
}

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

/**
 * Route-handler guard. Returns a 401 NextResponse when unauthenticated,
 * or null when the request is authorized. Defense-in-depth: every sensitive
 * route calls this, so security never relies on middleware alone.
 */
export async function requireAuth(request: Request): Promise<NextResponse | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (await verifySessionToken(token)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
