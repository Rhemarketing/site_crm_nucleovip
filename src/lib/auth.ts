import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";

import {
  AUTH_COOKIE_NAME,
  type AuthSession,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth-token";

const PASSWORD_SALT_ROUNDS = 12;

export { createSessionToken, verifySessionToken };
export type { AuthSession };

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function getCurrentUser(): Promise<AuthSession | null> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  const userId = requestHeaders.get("x-user-id");
  const role = requestHeaders.get("x-user-role");
  const email = requestHeaders.get("x-user-email");

  if (
    tenantId &&
    userId &&
    email &&
    (role === "ADMIN" || role === "AGENT")
  ) {
    return { tenantId, userId, role, email };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getTenantId() {
  return (await getCurrentUser())?.tenantId ?? null;
}

export async function requireCurrentUser() {
  const session = await getCurrentUser();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
