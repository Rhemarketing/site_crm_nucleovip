import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { getCampaignPercentage } from "@/lib/campaigns";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { getCampaignQueue } from "@/queues/campaign.queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const current = await prisma.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!current) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }
  if (!["QUEUED", "PROCESSING"].includes(current.status)) {
    return NextResponse.json(
      { error: "Somente campanhas agendadas ou em processamento podem ser canceladas." },
      { status: 409 },
    );
  }

  const job = await getCampaignQueue().getJob(current.id);
  if (job) {
    const state = await job.getState();
    if (state !== "active") await job.remove();
  }

  const campaign = await prisma.campaign.update({
    where: { id: current.id },
    data: {
      status: "CANCELLED",
      cancelRequestedAt: new Date(),
      completedAt: new Date(),
    },
  });
  await publishChatEvent({
    type: "CAMPAIGN_PROGRESS",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: {
      campaignId: campaign.id,
      status: campaign.status,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      totalRecipients: campaign.totalRecipients,
      percentage: getCampaignPercentage(campaign),
    },
  });
  return NextResponse.json({ success: true, campaign });
}
