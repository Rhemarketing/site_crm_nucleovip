import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { MetaWhatsAppError } from "@/services/meta-whatsapp.service";
import {
  createWhatsAppAccount,
  listWhatsAppAccounts,
  type CreateWhatsAppAccountInput,
} from "@/services/whatsapp-account.service";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireCurrentUser();
  const accounts = await listWhatsAppAccounts(session.tenantId);
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

  let body: Partial<CreateWhatsAppAccountInput>;

  try {
    body = (await request.json()) as Partial<CreateWhatsAppAccountInput>;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const input = {
    name: body.name?.trim() ?? "",
    phoneNumberId: body.phoneNumberId?.trim() ?? "",
    wabaId: body.wabaId?.trim() ?? "",
    accessToken: body.accessToken?.trim() ?? "",
    businessAccountId: body.businessAccountId?.trim() ?? "",
  };

  if (Object.values(input).some((value) => !value)) {
    return NextResponse.json(
      { error: "name, phoneNumberId, wabaId, accessToken e businessAccountId sao obrigatorios." },
      { status: 400 },
    );
  }

  try {
    const account = await createWhatsAppAccount(session.tenantId, input);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) {
      return NextResponse.json(
        { error: "Credenciais da Meta invalidas.", meta: error.toJSON() },
        { status: 422 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Este phoneNumberId ja esta cadastrado neste tenant." },
        { status: 409 },
      );
    }

    console.error("Falha ao criar conta WhatsApp", error);
    return NextResponse.json({ error: "Nao foi possivel criar a conexao." }, { status: 500 });
  }
}
