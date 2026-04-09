import { NextResponse } from "next/server";
import { acceptTeamInvite } from "@/lib/team-invites";
import { requireRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim();

    if (!token) {
      throw new Error("token is required.");
    }

    const result = await acceptTeamInvite({
      token,
      userEmail: user.email,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept the team invite.";
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
