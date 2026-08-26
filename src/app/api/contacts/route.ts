import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeContact } from "@/lib/contact-serializers";
import { buildContactWhere, contactInclude } from "@/lib/contact-query";
import {
  ContactValidationError,
  parseContactInput,
  type ContactInput,
} from "@/lib/contact-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25));
  const where = buildContactWhere(session.tenantId, searchParams);
  const [contacts, total] = await prisma.$transaction([
    prisma.contact.findMany({
      where,
      include: contactInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    contacts: contacts.map(serializeContact),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  let body: ContactInput & { tagIds?: string[] };

  try {
    body = (await request.json()) as typeof body;
    const input = parseContactInput(body);
    const tagIds = [...new Set(body.tagIds ?? [])];
    const validTags = tagIds.length
      ? await prisma.tag.findMany({
          where: { tenantId: session.tenantId, id: { in: tagIds } },
          select: { id: true },
        })
      : [];

    if (validTags.length !== tagIds.length) {
      return NextResponse.json({ error: "Uma ou mais etiquetas sao invalidas." }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        tenantId: session.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        avatarUrl: input.avatarUrl,
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
        contactTags: {
          create: validTags.map((tag) => ({ tenantId: session.tenantId, tagId: tag.id })),
        },
      },
      include: contactInclude,
    });

    return NextResponse.json({ contact: serializeContact(contact) }, { status: 201 });
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Telefone ja cadastrado." }, { status: 409 });
    }
    console.error("Falha ao criar contato", error);
    return NextResponse.json({ error: "Nao foi possivel criar o contato." }, { status: 500 });
  }
}
