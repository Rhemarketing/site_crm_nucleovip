import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetaWhatsAppError, metaWhatsAppService } from "@/services/meta-whatsapp.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  const { id } = await context.params;
  const template = await prisma.template.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!template) return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  if (!template.whatsappAccountId) {
    await prisma.template.delete({ where: { id: template.id } });
    return new NextResponse(null, { status: 204 });
  }
  try {
    await metaWhatsAppService.deleteTemplate(template.whatsappAccountId, template.name);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) return NextResponse.json({ error: error.message, meta: error.toJSON() }, { status: error.isRateLimit ? 429 : 502 });
    throw error;
  }
}
