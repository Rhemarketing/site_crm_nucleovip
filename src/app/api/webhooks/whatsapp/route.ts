import { after, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getWebhookQueue } from "@/queues/webhook.queue";
import {
  getWebhookPhoneNumberIds,
  type MetaWebhookPayload,
} from "@/types/meta-webhook";

export const runtime = "nodejs";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    verifyToken === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

async function dispatchWebhook(rawPayload: MetaWebhookPayload, receivedAt: string) {
  const phoneNumberIds = getWebhookPhoneNumberIds(rawPayload);

  if (!phoneNumberIds.length) {
    console.warn("Webhook da Meta sem phone_number_id.");
    return;
  }

  const accounts = await prisma.whatsAppAccount.findMany({
    where: {
      phoneNumberId: { in: phoneNumberIds },
      status: "ACTIVE",
    },
    select: { id: true, tenantId: true, phoneNumberId: true },
  });

  if (!accounts.length) {
    console.warn("Webhook recebido para phone_number_id nao cadastrado.", {
      phoneNumberIds,
    });
    return;
  }

  await Promise.all(
    accounts.map((account) =>
      getWebhookQueue().add("process-meta-webhook", {
        tenantId: account.tenantId,
        whatsappAccountId: account.id,
        phoneNumberId: account.phoneNumberId,
        rawPayload,
        receivedAt,
      }),
    ),
  );
}

export async function POST(request: Request) {
  let rawPayload: MetaWebhookPayload;

  try {
    rawPayload = (await request.json()) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();

  after(async () => {
    try {
      await dispatchWebhook(rawPayload, receivedAt);
    } catch (error) {
      console.error("Falha ao despachar webhook para a fila", error);
    }
  });

  return NextResponse.json({ status: "success" }, { status: 200 });
}
