import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_API = "https://api.stripe.com/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://otomasyon-site.vercel.app";

const PLANS = {
  starter: {
    name: "Starter",
    price_monthly: 29,
    videos_per_month: 30,
    features: ["Dashboard & analytics", "Calendar & ideas", "30 video productions/mo"],
  },
  pro: {
    name: "Pro",
    price_monthly: 49,
    videos_per_month: 100,
    features: ["Everything in Starter", "100 video productions/mo", "Thumbnail A/B testing", "Priority support"],
  },
  unlimited: {
    name: "Unlimited",
    price_monthly: 99,
    videos_per_month: -1,
    features: ["Everything in Pro", "Unlimited productions", "API access", "White-label options"],
  },
};

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  return NextResponse.json({
    plans: PLANS,
    stripe_configured: !!STRIPE_SECRET,
    current_plan: "starter",
    usage: { videos_this_month: 0, limit: 30 },
  });
}

export async function POST(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;

  if (!STRIPE_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const action = body?.action;

  if (action === "create_checkout") {
    const plan = body.plan as keyof typeof PLANS;
    if (!PLANS[plan]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    try {
      const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "mode": "subscription",
          "success_url": `${APP_URL}/settings?billing=success`,
          "cancel_url": `${APP_URL}/settings?billing=cancelled`,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(PLANS[plan].price_monthly * 100),
          "line_items[0][price_data][recurring][interval]": "month",
          "line_items[0][price_data][product_data][name]": `MindPower OS ${PLANS[plan].name}`,
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

  if (action === "portal") {
    return NextResponse.json({ error: "Customer portal not yet configured" }, { status: 501 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
