import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth-token";

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return unauthorized(request);
  }

  try {
    const session = await verifySessionToken(token);
    const requestHeaders = new Headers(request.headers);

    requestHeaders.set("x-tenant-id", session.tenantId);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-user-email", session.email);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    const response = unauthorized(request);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/internal/:path*",
    "/api/whatsapp-accounts/:path*",
  ],
};
