import { NextResponse } from "next/server";
import { createTeamInvite } from "@/lib/team-invites";
import { requireRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as
      | {
          email?: string;
          role?: string;
          teamId?: string;
        }
      | null;

    const teamId = body?.teamId?.trim();
    const email = body?.email?.trim();
    const role = body?.role?.trim();

    if (!teamId) {
      throw new Error("teamId is required.");
    }

    if (!email) {
      throw new Error("email is required.");
    }

    if (!role) {
      throw new Error("role is required.");
    }

    const invite = await createTeamInvite({
      appOrigin: new URL(request.url).origin,
      email,
      inviterEmail: user.email ?? null,
      role,
      teamId,
      userId: user.id,
    });

    return NextResponse.json({
      delivery: invite.delivery,
      invite: invite.invite,
      ok: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the team invite.";
    const status = message === "Unauthorized." ? 401 : 400;

    return NextResponse.json(
      {
        message,
        ok: false,
      },
      { status }
    );
  }
}
