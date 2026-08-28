import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";

export async function GET() {
  await requireCurrentUser();
  return NextResponse.json({
    appId: process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID || "",
    configId:
      process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ||
      process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
      "",
  });
}
