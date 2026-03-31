import { NextResponse } from "next/server";
import { PRODUCT_NAME, SUPPORTED_SITES } from "@/lib/product/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: PRODUCT_NAME,
    supportedSites: SUPPORTED_SITES,
    timestamp: new Date().toISOString(),
  });
}

