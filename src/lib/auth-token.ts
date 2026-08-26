import { jwtVerify, SignJWT } from "jose";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "crm_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "ADMIN" | "AGENT";

export type AuthSession = {
  userId: string;
  tenantId: string;
  role: SessionRole;
  email: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET ou NEXTAUTH_SECRET deve ter pelo menos 32 caracteres.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AuthSession) {
  return new SignJWT({
    tenantId: session.tenantId,
    role: session.role,
    email: session.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<AuthSession> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });

  if (
    !payload.sub ||
    typeof payload.tenantId !== "string" ||
    typeof payload.email !== "string" ||
    (payload.role !== "ADMIN" && payload.role !== "AGENT")
  ) {
    throw new Error("Token de sessao invalido.");
  }

  return {
    userId: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    email: payload.email,
  };
}
