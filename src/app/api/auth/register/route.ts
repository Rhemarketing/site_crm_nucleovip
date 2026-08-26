import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RegisterBody = {
  organizationName?: string;
  document?: string;
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const organizationName = body.organizationName?.trim();
  const document = body.document?.trim() || null;
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!organizationName || !name || !email || !email.includes("@")) {
    return NextResponse.json(
      { error: "organizationName, name e email valido sao obrigatorios." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const tenant = await prisma.$transaction(async (transaction) => {
      const createdTenant = await transaction.tenant.create({
        data: { name: organizationName, document },
      });

      await transaction.user.create({
        data: {
          tenantId: createdTenant.id,
          name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });

      return createdTenant;
    });

    return NextResponse.json(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          document: tenant.document,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Documento ou usuario ja cadastrado." },
        { status: 409 },
      );
    }

    console.error("Falha ao registrar tenant", error);
    return NextResponse.json(
      { error: "Nao foi possivel concluir o cadastro." },
      { status: 500 },
    );
  }
}
