import { NextResponse } from "next/server";
import { createIndividualCheckoutSession } from "@/lib/billing/stripe-sessions";
import { requireRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const checkoutUrl = await createIndividualCheckoutSession({
      appOrigin: new URL(request.url).origin,
      email: user.email,
      profileId: user.id,
    });

    return NextResponse.json({
      ok: true,
      url: checkoutUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Stripe checkout.";
    const status = message === "Unauthorized." ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status }
    );
  }
}
