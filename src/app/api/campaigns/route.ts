import { CampaignStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { getTemplateVariables } from "@/lib/template-utils";
import { addCampaignToQueue } from "@/queues/campaign.queue";

export const dynamic = "force-dynamic";

type CreateCampaignBody = {
  name?: string;
  whatsappAccountId?: string;
  templateId?: string;
  tagIds?: string[];
  variableMappings?: Record<string, unknown>;
  scheduledAt?: string | null;
};

const campaignInclude = {
  whatsappAccount: { select: { id: true, name: true, phoneNumberId: true } },
  template: {
    select: {
      id: true,
      name: true,
      language: true,
      category: true,
      components: true,
    },
  },
} satisfies Prisma.CampaignInclude;

export async function GET(request: Request) {
  const session = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status")?.toUpperCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25),
  );

  if (
    status &&
    !Object.values(CampaignStatus).includes(status as CampaignStatus)
  ) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const where: Prisma.CampaignWhereInput = {
    tenantId: session.tenantId,
    ...(status ? { status: status as CampaignStatus } : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" } }
      : {}),
  };

  const [campaigns, total, totals, accounts, templates, tags] =
    await prisma.$transaction([
      prisma.campaign.findMany({
        where,
        include: campaignInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.campaign.count({ where }),
      prisma.campaign.aggregate({
        where: { tenantId: session.tenantId },
        _sum: {
          totalRecipients: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
        },
      }),
      prisma.whatsAppAccount.findMany({
        where: { tenantId: session.tenantId, status: "ACTIVE" },
        select: { id: true, name: true, phoneNumberId: true },
        orderBy: { name: "asc" },
      }),
      prisma.template.findMany({
        where: { tenantId: session.tenantId, status: "APPROVED" },
        select: {
          id: true,
          whatsappAccountId: true,
          name: true,
          language: true,
          category: true,
          components: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.tag.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const summary = {
    totalRecipients: totals._sum.totalRecipients ?? 0,
    sentCount: totals._sum.sentCount ?? 0,
    deliveredCount: totals._sum.deliveredCount ?? 0,
    readCount: totals._sum.readCount ?? 0,
    failedCount: totals._sum.failedCount ?? 0,
  };

  return NextResponse.json({
    campaigns: campaigns.map(serializeCampaign),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    metrics: {
      ...summary,
      averageReadRate: summary.deliveredCount
        ? Math.round((summary.readCount / summary.deliveredCount) * 100)
        : 0,
    },
    creationData: { accounts, templates, tags },
  });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as CreateCampaignBody | null;
  const name = body?.name?.trim();
  const tagIds = [...new Set(body?.tagIds ?? [])];
  const variableMappings = body?.variableMappings ?? {};
  const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;

  if (
    !name ||
    name.length < 3 ||
    name.length > 120 ||
    !body?.whatsappAccountId ||
    !body.templateId
  ) {
    return NextResponse.json(
      { error: "Nome, conta WhatsApp e template são obrigatórios." },
      { status: 400 },
    );
  }
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json(
      { error: "Data de agendamento inválida." },
      { status: 400 },
    );
  }

  const [account, template, validTagCount] = await Promise.all([
    prisma.whatsAppAccount.findFirst({
      where: {
        id: body.whatsappAccountId,
        tenantId: session.tenantId,
        status: "ACTIVE",
      },
      select: { id: true },
    }),
    prisma.template.findFirst({
      where: {
        id: body.templateId,
        tenantId: session.tenantId,
        whatsappAccountId: body.whatsappAccountId,
        status: "APPROVED",
      },
      select: { id: true, components: true },
    }),
    tagIds.length
      ? prisma.tag.count({
          where: { tenantId: session.tenantId, id: { in: tagIds } },
        })
      : Promise.resolve(0),
  ]);

  if (!account || !template) {
    return NextResponse.json(
      { error: "Conta ou template aprovado não encontrado." },
      { status: 404 },
    );
  }
  if (validTagCount !== tagIds.length) {
    return NextResponse.json(
      { error: "Uma ou mais etiquetas são inválidas." },
      { status: 400 },
    );
  }

  const variables = getTemplateVariables(template.components);
  const missingMappings = variables.filter(
    (variable) => variableMappings[variable] === undefined,
  );
  if (missingMappings.length) {
    return NextResponse.json(
      {
        error: `Configure as variáveis: ${missingMappings
          .map((variable) => `{{${variable}}}`)
          .join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: session.tenantId,
      whatsappAccountId: body.whatsappAccountId,
      templateId: body.templateId,
      name,
      status: "QUEUED",
      tagIds: tagIds as Prisma.InputJsonValue,
      variableMappings: variableMappings as Prisma.InputJsonValue,
      scheduledAt,
    },
    include: campaignInclude,
  });

  try {
    const delay = scheduledAt
      ? Math.max(0, scheduledAt.getTime() - Date.now())
      : 0;
    await addCampaignToQueue(campaign.id, delay);
    return NextResponse.json(
      { campaign: serializeCampaign(campaign) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Falha ao enfileirar campanha", error);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    return NextResponse.json(
      { error: "A campanha foi criada, mas não pôde ser enfileirada." },
      { status: 503 },
    );
  }
}
