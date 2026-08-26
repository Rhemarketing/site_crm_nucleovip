import { NextResponse } from "next/server";

import {
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
  tenantId?: string;
  tenantDocument?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const tenantId = body.tenantId?.trim();
  const tenantDocument = body.tenantDocument?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha sao obrigatorios." },
      { status: 400 },
    );
  }

  const users = await prisma.user.findMany({
    where: {
      email,
      tenant: {
        status: "ACTIVE",
        ...(tenantId ? { id: tenantId } : {}),
        ...(tenantDocument ? { document: tenantDocument } : {}),
      },
    },
    include: { tenant: { select: { id: true, name: true } } },
    take: 2,
  });

  if (users.length > 1) {
    return NextResponse.json(
      { error: "Informe tenantId ou tenantDocument para selecionar a organizacao." },
      { status: 409 },
    );
  }

  const user = users[0];
  const validPassword = user
    ? await verifyPassword(password, user.passwordHash)
    : false;

  if (!user || !validPassword) {
    return NextResponse.json(
      { error: "Credenciais invalidas." },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: user.tenant,
    },
  });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return response;
}
