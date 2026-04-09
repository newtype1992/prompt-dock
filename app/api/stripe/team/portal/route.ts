import { NextResponse } from "next/server";
import { createTeamBillingPortalSession } from "@/lib/billing/stripe-sessions";
import { requireRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as { teamId?: string } | null;
    const teamId = body?.teamId?.trim();

    if (!teamId) {
      throw new Error("teamId is required.");
    }

    const portalUrl = await createTeamBillingPortalSession({
      appOrigin: new URL(request.url).origin,
      teamId,
      userId: user.id,
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
