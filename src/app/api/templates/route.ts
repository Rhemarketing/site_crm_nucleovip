import { Prisma, TemplateCategory, TemplateStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareTemplateComponents } from "@/lib/template-utils";
import { MetaWhatsAppError, metaWhatsAppService, type CreateMetaTemplateInput } from "@/services/meta-whatsapp.service";

export const dynamic = "force-dynamic";

function metaErrorResponse(error: MetaWhatsAppError) {
  return NextResponse.json({ error: error.message, meta: error.toJSON() }, { status: error.isRateLimit ? 429 : 502 });
}

export async function GET(request: Request) {
  const session = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("whatsappAccountId")?.trim();
  const status = searchParams.get("status")?.toUpperCase();
  const category = searchParams.get("category")?.toUpperCase();
  const where: Prisma.TemplateWhereInput = {
    tenantId: session.tenantId,
    ...(accountId ? { whatsappAccountId: accountId } : {}),
    ...(status && Object.values(TemplateStatus).includes(status as TemplateStatus) ? { status: status as TemplateStatus } : {}),
    ...(category && Object.values(TemplateCategory).includes(category as TemplateCategory) ? { category: category as TemplateCategory } : {}),
  };
  const [templates, accounts] = await prisma.$transaction([
    prisma.template.findMany({
      where,
      include: { whatsappAccount: { select: { id: true, name: true, phoneNumberId: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.whatsAppAccount.findMany({
      where: { tenantId: session.tenantId, status: "ACTIVE" },
      select: { id: true, name: true, phoneNumberId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ templates, accounts });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as (CreateMetaTemplateInput & { whatsappAccountId?: string }) | null;
  const name = body?.name?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!body?.whatsappAccountId || !name || !body.language || !body.category || !Array.isArray(body.components) || !body.components.length) {
    return NextResponse.json({ error: "Conta, nome, idioma, categoria e componentes sao obrigatorios." }, { status: 400 });
  }
  const account = await prisma.whatsAppAccount.findFirst({ where: { id: body.whatsappAccountId, tenantId: session.tenantId, status: "ACTIVE" } });
  if (!account) return NextResponse.json({ error: "Conta WhatsApp nao encontrada." }, { status: 404 });
  try {
    const template = await metaWhatsAppService.createTemplate(account.id, { name, language: body.language, category: body.category, components: prepareTemplateComponents(body.components) });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) return metaErrorResponse(error);
    throw error;
  }
}
