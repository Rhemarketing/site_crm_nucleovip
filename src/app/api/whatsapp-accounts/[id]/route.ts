import { Prisma, type WhatsAppAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import {
  deleteWhatsAppAccount,
  updateWhatsAppAccount,
} from "@/services/whatsapp-account.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { name?: string; status?: WhatsAppAccountStatus };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const status = body.status;

  if (status && status !== "ACTIVE" && status !== "INACTIVE") {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  if (!name && !status) {
    return NextResponse.json({ error: "Informe name ou status." }, { status: 400 });
  }

  const account = await updateWhatsAppAccount(session.tenantId, id, {
    ...(name ? { name } : {}),
    ...(status ? { status } : {}),
  });

  if (!account) {
    return NextResponse.json({ error: "Conexao nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ account });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteWhatsAppAccount(session.tenantId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Conexao nao encontrada." }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "A conexao possui dados relacionados. Desative-a em vez de remove-la." },
        { status: 409 },
      );
    }

    throw error;
  }
}
