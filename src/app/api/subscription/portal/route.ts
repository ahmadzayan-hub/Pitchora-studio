import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/db/supabase-server";
import { getStripe } from "@/lib/stripe/client";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).single();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "No billing account" }, { status: 404 });

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription`,
  });
  return NextResponse.json({ url: session.url });
}
