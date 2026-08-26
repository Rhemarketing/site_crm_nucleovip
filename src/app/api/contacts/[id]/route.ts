import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeContact } from "@/lib/contact-serializers";
import { contactInclude } from "@/lib/contact-query";
import { ContactValidationError, parseContactInput, type ContactInput } from "@/lib/contact-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      ...contactInclude,
      conversations: {
        select: { id: true, status: true, lastMessageAt: true, whatsappAccountId: true },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      },
    },
  });

  if (!contact) return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 });
  return NextResponse.json({
    contact: { ...serializeContact(contact), conversations: contact.conversations },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  let body: ContactInput & { tagIds?: string[] };

  try {
    body = (await request.json()) as typeof body;
    const current = await prisma.contact.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!current) return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 });
    const input = parseContactInput({
      name: body.name ?? current.name,
      phone: body.phone ?? current.phone,
      email: body.email ?? current.email,
      avatarUrl: body.avatarUrl ?? current.avatarUrl,
      customFields: body.customFields ?? current.customFields,
    });
    const tagIds = body.tagIds ? [...new Set(body.tagIds)] : null;
    if (tagIds) {
      const validTagCount = await prisma.tag.count({ where: { tenantId: session.tenantId, id: { in: tagIds } } });
      if (validTagCount !== tagIds.length) return NextResponse.json({ error: "Etiquetas invalidas." }, { status: 400 });
    }

    const contact = await prisma.$transaction(async (transaction) => {
      if (tagIds) {
        await transaction.contactTag.deleteMany({ where: { tenantId: session.tenantId, contactId: id } });
      }
      return transaction.contact.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          avatarUrl: input.avatarUrl,
          ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
          ...(tagIds ? { contactTags: { create: tagIds.map((tagId) => ({ tenantId: session.tenantId, tagId })) } } : {}),
        },
        include: contactInclude,
      });
    });
    return NextResponse.json({ contact: serializeContact(contact) });
  } catch (error) {
    if (error instanceof ContactValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Telefone ja cadastrado." }, { status: 409 });
    console.error("Falha ao atualizar contato", error);
    return NextResponse.json({ error: "Nao foi possivel atualizar o contato." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  try {
    const deleted = await prisma.contact.deleteMany({ where: { id, tenantId: session.tenantId } });
    if (!deleted.count) return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Contato possui conversas e nao pode ser excluido." }, { status: 409 });
    }
    throw error;
  }
}
