import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { MetaWhatsAppError } from "@/services/meta-whatsapp.service";
import { createWhatsAppAccount } from "@/services/whatsapp-account.service";

export const runtime = "nodejs";

async function exchangeCode(code: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_NOT_CONFIGURED");
  const version = process.env.META_GRAPH_API_VERSION ?? "v21.0";
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });
  if (process.env.META_EMBEDDED_SIGNUP_REDIRECT_URI)
    params.set("redirect_uri", process.env.META_EMBEDDED_SIGNUP_REDIRECT_URI);
  const response = await fetch(
    `https://graph.facebook.com/${version}/oauth/access_token?${params}`,
  );
  const data = (await response.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.access_token)
    throw new Error(
      data.error?.message || "A Meta não retornou o token de acesso.",
    );
  const longLivedParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: data.access_token,
  });
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/${version}/oauth/access_token?${longLivedParams}`,
  );
  const longLived = (await longLivedResponse.json()) as {
    access_token?: string;
  };
  return longLivedResponse.ok && longLived.access_token
    ? longLived.access_token
    : data.access_token;
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    sessionInfo?: {
      phone_number_id?: string;
      waba_id?: string;
      business_id?: string;
    };
    name?: string;
  } | null;
  const code = body?.code?.trim();
  const info = body?.sessionInfo;
  if (!code)
    return NextResponse.json(
      { error: "Código de autorização ausente." },
      { status: 400 },
    );
  if (!info?.phone_number_id || !info.waba_id)
    return NextResponse.json(
      {
        error:
          "A Meta não informou o número ou a conta WABA. Repita o cadastro e conclua todas as etapas.",
      },
      { status: 400 },
    );
  try {
    const accessToken = await exchangeCode(code);
    const account = await createWhatsAppAccount(session.tenantId, {
      name: body?.name?.trim() || `WhatsApp ${info.phone_number_id.slice(-4)}`,
      phoneNumberId: info.phone_number_id,
      wabaId: info.waba_id,
      businessAccountId: info.business_id || info.waba_id,
      accessToken,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError)
      return NextResponse.json(
        { error: error.userMessage, meta: error.toJSON() },
        { status: 422 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "Este número já está conectado." },
        { status: 409 },
      );
    console.error("Embedded Signup falhou", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "META_NOT_CONFIGURED"
            ? "Configure META_APP_ID e META_APP_SECRET no servidor."
            : "Não foi possível concluir o cadastro integrado da Meta.",
      },
      { status: 500 },
    );
  }
}
