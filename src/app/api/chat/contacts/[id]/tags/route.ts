import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
type TagBody = { tagId?: string; conversationId?: string };

async function parseBody(request: Request) {
  try {
    return (await request.json()) as TagBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id: contactId } = await context.params;
  const body = await parseBody(request);

  if (!body?.tagId || !body.conversationId) {
    return NextResponse.json({ error: "tagId e conversationId sao obrigatorios." }, { status: 400 });
  }

  const [contact, tag] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, tenantId: session.tenantId } }),
    prisma.tag.findFirst({ where: { id: body.tagId, tenantId: session.tenantId } }),
  ]);

  if (!contact || !tag) {
    return NextResponse.json({ error: "Contato ou etiqueta nao encontrado." }, { status: 404 });
  }

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId: tag.id } },
    create: { tenantId: session.tenantId, contactId, tagId: tag.id },
    update: {},
  });
  await publishChatEvent({
    type: "CONVERSATION_UPDATED",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: { conversationId: body.conversationId },
  });
  return NextResponse.json({ tag });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id: contactId } = await context.params;
  const body = await parseBody(request);

  if (!body?.tagId || !body.conversationId) {
    return NextResponse.json({ error: "tagId e conversationId sao obrigatorios." }, { status: 400 });
  }

  await prisma.contactTag.deleteMany({
    where: { tenantId: session.tenantId, contactId, tagId: body.tagId },
  });
  await publishChatEvent({
    type: "CONVERSATION_UPDATED",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: { conversationId: body.conversationId },
  });
  return new NextResponse(null, { status: 204 });
}
