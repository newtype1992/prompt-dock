import { NextResponse } from "next/server";
import { createIndividualBillingPortalSession } from "@/lib/billing/stripe-sessions";
import { requireRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const portalUrl = await createIndividualBillingPortalSession({
      appOrigin: new URL(request.url).origin,
      profileId: user.id,
    });

    return NextResponse.json({
      ok: true,
      url: portalUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Stripe billing portal session.";
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
