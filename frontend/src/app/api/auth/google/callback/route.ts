import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://otomasyon-site.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get user info");
  return res.json();
}

async function getYouTubeChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((ch: Record<string, unknown>) => {
    const snippet = ch.snippet as Record<string, unknown>;
    const stats = ch.statistics as Record<string, string>;
    const thumbs = snippet.thumbnails as Record<string, { url: string }>;
    return {
      id: ch.id as string,
      title: snippet.title as string,
      thumbnail: thumbs?.default?.url || "",
      subscriberCount: parseInt(stats.subscriberCount || "0"),
      videoCount: parseInt(stats.videoCount || "0"),
      viewCount: parseInt(stats.viewCount || "0"),
    };
  });
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/login?error=oauth_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/login?error=missing_code`);
  }

  const savedState = readCookie(request, "oauth_state");
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    const user = await getGoogleUser(tokens.access_token);
    const channels = await getYouTubeChannels(tokens.access_token);

    const userPayload = JSON.stringify({
      email: user.email,
      name: user.name,
      picture: user.picture,
      channels,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      token_expires: Date.now() + tokens.expires_in * 1000,
    });

    const token = await sessionToken();
    const res = NextResponse.redirect(`${APP_URL}/`);

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    const encoded = Buffer.from(userPayload).toString("base64");
    res.cookies.set("mp_user", encoded, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });

    return res;
  } catch (e) {
    console.error("OAuth callback error:", e);
    return NextResponse.redirect(`${APP_URL}/login?error=oauth_failed`);
  }
}
