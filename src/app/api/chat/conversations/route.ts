import { ConversationStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeConversation } from "@/lib/chat-serializers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const conversationInclude = {
  contact: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      contactTags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  },
  whatsappAccount: {
    select: { id: true, name: true, phoneNumberId: true },
  },
  assignedUser: { select: { id: true, name: true, email: true } },
  assignmentHistory: {
    select: {
      id: true,
      createdAt: true,
      assignedUser: { select: { id: true, name: true } },
      assignedByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: 8,
  },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.ConversationInclude;

export async function GET(request: Request) {
  const session = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const accountId = searchParams.get("accountId")?.trim();
  const assignedUserId = searchParams.get("assignedUserId")?.trim();
  const statusParam = searchParams.get("status")?.toUpperCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 30) || 30),
  );

  if (
    statusParam &&
    !Object.values(ConversationStatus).includes(statusParam as ConversationStatus)
  ) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  const where: Prisma.ConversationWhereInput = {
    tenantId: session.tenantId,
    ...(statusParam ? { status: statusParam as ConversationStatus } : {}),
    ...(accountId ? { whatsappAccountId: accountId } : {}),
    ...(assignedUserId === "unassigned"
      ? { assignedUserId: null }
      : assignedUserId
        ? { assignedUserId }
        : {}),
    ...(search
      ? {
          contact: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const [conversations, total, accounts, users, tags] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      include: conversationInclude,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({ where }),
    prisma.whatsAppAccount.findMany({
      where: { tenantId: session.tenantId, status: "ACTIVE" },
      select: { id: true, name: true, phoneNumberId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    conversations: conversations.map(serializeConversation),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    filters: { accounts, users, tags },
  });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  const body = (await request.json().catch(() => null)) as { contactId?: string; whatsappAccountId?: string } | null;
  if (!body?.contactId || !body.whatsappAccountId) {
    return NextResponse.json({ error: "contactId e whatsappAccountId sao obrigatorios." }, { status: 400 });
  }
  const [contact, account] = await Promise.all([
    prisma.contact.findFirst({ where: { id: body.contactId, tenantId: session.tenantId }, select: { id: true } }),
    prisma.whatsAppAccount.findFirst({ where: { id: body.whatsappAccountId, tenantId: session.tenantId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!contact || !account) return NextResponse.json({ error: "Contato ou conta nao encontrado." }, { status: 404 });
  const existing = await prisma.conversation.findFirst({
    where: { tenantId: session.tenantId, contactId: contact.id, whatsappAccountId: account.id, status: { in: ["OPEN", "PENDING"] } },
    orderBy: { updatedAt: "desc" },
  });
  const conversation = existing
    ? existing.status === "PENDING"
      ? await prisma.conversation.update({ where: { id: existing.id }, data: { status: "OPEN" } })
      : existing
    : await prisma.conversation.create({
        data: { tenantId: session.tenantId, contactId: contact.id, whatsappAccountId: account.id, status: "OPEN", is24hWindowActive: false },
      });
  return NextResponse.json({ conversation: { id: conversation.id } }, { status: existing ? 200 : 201 });
}
