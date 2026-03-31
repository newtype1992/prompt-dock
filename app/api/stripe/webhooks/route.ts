import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      status: "stub",
      message: "Stripe webhook handling is scaffolded but not implemented yet.",
    },
    { status: 202 }
  );
}

