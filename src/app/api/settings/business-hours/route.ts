import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  DEFAULT_BUSINESS_HOURS,
  isValidTime,
  parseBusinessHours,
  type BusinessHours,
} from "@/lib/business-hours";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireCurrentUser();
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId: session.tenantId },
    create: {
      tenantId: session.tenantId,
      businessHours: DEFAULT_BUSINESS_HOURS,
    },
    update: {},
  });
  return NextResponse.json({
    settings: {
      ...settings,
      businessHours: parseBusinessHours(settings.businessHours),
      outOfOfficeEnabled: settings.isOutOfOfficeActive,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    businessHours?: BusinessHours;
    timezone?: string;
    outOfOfficeEnabled?: boolean;
    outOfOfficeMessage?: string;
  } | null;
  const timezone = body?.timezone?.trim() || "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
  } catch {
    return NextResponse.json(
      { error: "Fuso horário inválido." },
      { status: 400 },
    );
  }
  const businessHours = parseBusinessHours(body?.businessHours);
  if (
    Object.values(businessHours).some(
      (day) => !isValidTime(day.open) || !isValidTime(day.close),
    )
  ) {
    return NextResponse.json(
      { error: "Informe horários válidos no formato HH:mm." },
      { status: 400 },
    );
  }
  const message = body?.outOfOfficeMessage?.trim() || null;
  if (body?.outOfOfficeEnabled && !message) {
    return NextResponse.json(
      { error: "Informe a mensagem de ausência." },
      { status: 400 },
    );
  }
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId: session.tenantId },
    create: {
      tenantId: session.tenantId,
      businessHours: businessHours as Prisma.InputJsonValue,
      timezone,
      isOutOfOfficeActive: Boolean(body?.outOfOfficeEnabled),
      outOfOfficeMessage: message,
    },
    update: {
      businessHours: businessHours as Prisma.InputJsonValue,
      timezone,
      isOutOfOfficeActive: Boolean(body?.outOfOfficeEnabled),
      outOfOfficeMessage: message,
    },
  });
  return NextResponse.json({ settings });
}
