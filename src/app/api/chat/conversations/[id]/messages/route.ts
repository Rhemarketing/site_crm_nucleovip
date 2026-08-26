import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeChatMessage } from "@/lib/chat-serializers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 50) || 50),
  );
  const cursor = searchParams.get("cursor");

  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { tenantId: session.tenantId, conversationId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = messages.length > pageSize;
  const page = messages.slice(0, pageSize);
  const nextCursor = hasMore ? page.at(-1)?.id ?? null : null;

  return NextResponse.json({
    messages: page.reverse().map(serializeChatMessage),
    nextCursor,
  });
}
