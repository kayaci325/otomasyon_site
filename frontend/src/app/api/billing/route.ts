import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_API = "https://api.stripe.com/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://otomasyon-site.vercel.app";

const PATH = "config/billing.json";

interface BillingData {
  credits: number;
  total_spent: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: "purchase" | "production";
  amount: number;
  credits: number;
  description: string;
  created_at: string;
}

const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 9.99, label: "10 Credits", per_credit: "$1.00" },
  { id: "pack_50", credits: 50, price: 39.99, label: "50 Credits", per_credit: "$0.80", popular: true },
  { id: "pack_100", credits: 100, price: 69.99, label: "100 Credits", per_credit: "$0.70" },
  { id: "pack_500", credits: 500, price: 249.99, label: "500 Credits", per_credit: "$0.50", best_value: true },
];

function estimateVideoCost(format: "short" | "long", durationSec: number, sceneCount: number): { credits: number; breakdown: Record<string, number> } {
  const ttsCredits = format === "short"
    ? Math.ceil(durationSec / 15) * 0.3
    : Math.ceil(durationSec / 30) * 0.4;

  const imageCredits = sceneCount * 0.2;

  const processingCredits = format === "short" ? 0.5 : 1.0;

  const raw = ttsCredits + imageCredits + processingCredits;
  const credits = Math.max(1, Math.round(raw * 10) / 10);

  return {
    credits,
    breakdown: {
      tts: Math.round(ttsCredits * 100) / 100,
      images: Math.round(imageCredits * 100) / 100,
      processing: processingCredits,
    },
  };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
    const data = await readJsonFile<BillingData>(PATH, { credits: 0, total_spent: 0, transactions: [] });
    return NextResponse.json({
      credits: data.credits,
      total_spent: data.total_spent,
      recent_transactions: (data.transactions || []).slice(0, 20),
      credit_packs: CREDIT_PACKS,
      stripe_configured: !!STRIPE_SECRET,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const action = body?.action;

  if (action === "estimate") {
    const format = body.format === "long" ? "long" as const : "short" as const;
    const duration = Math.max(5, Number(body.duration_seconds) || 30);
    const scenes = Math.max(1, Number(body.scene_count) || 5);
    const est = estimateVideoCost(format, duration, scenes);
    return NextResponse.json(est);
  }

  if (action === "check_balance") {
    const format = body.format === "long" ? "long" as const : "short" as const;
    const duration = Math.max(5, Number(body.duration_seconds) || 30);
    const scenes = Math.max(1, Number(body.scene_count) || 5);
    const est = estimateVideoCost(format, duration, scenes);
    try {
      const data = await readJsonFile<BillingData>(PATH, { credits: 0, total_spent: 0, transactions: [] });
      return NextResponse.json({
        ...est,
        current_credits: data.credits,
        sufficient: data.credits >= est.credits,
      });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === "deduct") {
    const format = body.format === "long" ? "long" as const : "short" as const;
    const duration = Math.max(5, Number(body.duration_seconds) || 30);
    const scenes = Math.max(1, Number(body.scene_count) || 5);
    const title = String(body.title || "Video production");
    const est = estimateVideoCost(format, duration, scenes);

    try {
      await updateJsonFile<BillingData>(PATH, (data) => {
        if (!data.credits) data.credits = 0;
        if (!data.transactions) data.transactions = [];
        if (data.credits < est.credits) {
          throw new Error(`Insufficient credits: need ${est.credits}, have ${data.credits}`);
        }
        data.credits = Math.round((data.credits - est.credits) * 100) / 100;
        data.transactions.unshift({
          id: uid(),
          type: "production",
          amount: 0,
          credits: -est.credits,
          description: `${title} (${format}, ${duration}s, ${scenes} scenes)`,
          created_at: new Date().toISOString(),
        });
        return data;
      }, "billing: deduct credits");
      return NextResponse.json({ ok: true, deducted: est.credits });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === "buy_credits") {
    if (!STRIPE_SECRET) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    const pack = CREDIT_PACKS.find(p => p.id === body.pack_id);
    if (!pack) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

    try {
      const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: `${APP_URL}/settings?credits=success&pack=${pack.id}`,
          cancel_url: `${APP_URL}/settings?credits=cancelled`,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(Math.round(pack.price * 100)),
          "line_items[0][price_data][product_data][name]": `MindPower OS – ${pack.label}`,
          "line_items[0][quantity]": "1",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Stripe error: ${err}` }, { status: 502 });
      }
      const session = await res.json();
      return NextResponse.json({ url: session.url });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error" }, { status: 500 });
    }
  }

  if (action === "add_credits") {
    const credits = Math.max(0, Number(body.credits) || 0);
    const amount = Math.max(0, Number(body.amount) || 0);
    if (credits <= 0) return NextResponse.json({ error: "Invalid credits" }, { status: 400 });

    try {
      await updateJsonFile<BillingData>(PATH, (data) => {
        if (!data.credits) data.credits = 0;
        if (!data.total_spent) data.total_spent = 0;
        if (!data.transactions) data.transactions = [];
        data.credits = Math.round((data.credits + credits) * 100) / 100;
        data.total_spent = Math.round((data.total_spent + amount) * 100) / 100;
        data.transactions.unshift({
          id: uid(),
          type: "purchase",
          amount,
          credits,
          description: `Purchased ${credits} credits`,
          created_at: new Date().toISOString(),
        });
        return data;
      }, "billing: add credits");
      return NextResponse.json({ ok: true });
    } catch (e) {
      return fail(e);
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
