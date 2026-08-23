import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { getStripe, PLANS } from "@/lib/stripe/client";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { plan, interval } = await req.json() as { plan: keyof typeof PLANS; interval: "monthly"|"annual" };

  const planConfig = PLANS[plan];
  if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const stripe = getStripe();
  const supabase = await createClient();
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).single();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email ?? undefined,
    line_items: [{ price: planConfig[interval], quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=1`,
    metadata: { user_id: user.id, plan, interval },
  });

  return NextResponse.json({ url: session.url });
}
