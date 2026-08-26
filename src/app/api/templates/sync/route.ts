import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetaWhatsAppError, metaWhatsAppService } from "@/services/meta-whatsapp.service";

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { whatsappAccountId?: string } | null;
  if (!body?.whatsappAccountId) return NextResponse.json({ error: "whatsappAccountId obrigatorio." }, { status: 400 });
  const account = await prisma.whatsAppAccount.findFirst({ where: { id: body.whatsappAccountId, tenantId: session.tenantId, status: "ACTIVE" } });
  if (!account) return NextResponse.json({ error: "Conta WhatsApp nao encontrada." }, { status: 404 });
  try {
    const templates = await metaWhatsAppService.syncTemplates(account.id);
    return NextResponse.json({ synced: templates.length, templates });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) return NextResponse.json({ error: error.message, meta: error.toJSON() }, { status: error.isRateLimit ? 429 : 502 });
    throw error;
  }
}
