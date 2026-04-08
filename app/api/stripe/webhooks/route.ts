import { NextResponse } from "next/server";
import { handleStripeWebhookEvent } from "@/lib/billing/stripe-webhooks";
import { getStripeServerClient, getStripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing stripe-signature header.",
      },
      { status: 400 }
    );
  }

  const body = await request.text();
  const stripe = getStripeServerClient();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Stripe webhook verification failed.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result = await handleStripeWebhookEvent(event);

    return NextResponse.json({
      ok: true,
      eventType: event.type,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        eventType: event.type,
        message: error instanceof Error ? error.message : "Stripe webhook handling failed.",
      },
      {
        status: 500,
      }
    );
  }
}
