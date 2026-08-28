import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    shortcut?: string;
    title?: string;
    content?: string;
    mediaUrl?: string | null;
  } | null;
  const result = await prisma.quickReply.updateMany({
    where: { id, tenantId: session.tenantId },
    data: {
      ...(body?.shortcut
        ? { shortcut: body.shortcut.trim().toLowerCase().replace(/^\//, "") }
        : {}),
      ...(body?.title ? { title: body.title.trim() } : {}),
      ...(body?.content ? { content: body.content.trim() } : {}),
      ...(body?.mediaUrl !== undefined
        ? { mediaUrl: body.mediaUrl?.trim() || null }
        : {}),
    },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Resposta não encontrada." },
      { status: 404 },
    );
  return NextResponse.json({ success: true });
}
export async function DELETE(_request: Request, context: Context) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const result = await prisma.quickReply.deleteMany({
    where: { id, tenantId: session.tenantId },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Resposta não encontrada." },
      { status: 404 },
    );
  return new NextResponse(null, { status: 204 });
}
