import { Prisma, type TemplateCategory, type TemplateStatus, type WhatsAppAccount } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v21.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type MetaErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

type MetaRequestContext = {
  status: number;
  code?: number;
  subcode?: number;
  type?: string;
  traceId?: string;
  userTitle?: string;
  userMessage?: string;
  retryAfter?: string | null;
};

export class MetaWhatsAppError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly traceId?: string;
  readonly userTitle?: string;
  readonly userMessage?: string;
  readonly retryAfter?: string | null;
  readonly isRateLimit: boolean;
  readonly isExpiredSession: boolean;

  constructor(message: string, context: MetaRequestContext) {
    super(message);
    this.name = "MetaWhatsAppError";
    this.status = context.status;
    this.code = context.code;
    this.subcode = context.subcode;
    this.type = context.type;
    this.traceId = context.traceId;
    this.userTitle = context.userTitle;
    this.userMessage = context.userMessage;
    this.retryAfter = context.retryAfter;
    this.isRateLimit =
      context.status === 429 ||
      [4, 17, 32, 613].includes(context.code ?? 0);
    this.isExpiredSession =
      context.code === 190 || [458, 459, 460, 463, 464, 467].includes(context.subcode ?? 0);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      subcode: this.subcode,
      type: this.type,
      traceId: this.traceId,
      userTitle: this.userTitle,
      userMessage: this.userMessage,
      retryAfter: this.retryAfter,
      isRateLimit: this.isRateLimit,
      isExpiredSession: this.isExpiredSession,
    };
  }
}

async function graphRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("https://") ? path : `${GRAPH_API_BASE_URL}/${path.replace(/^\//, "")}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & MetaErrorBody;

  if (!response.ok || body.error) {
    const metaError = body.error;
    throw new MetaWhatsAppError(
      metaError?.message ?? `A Meta Graph API respondeu com HTTP ${response.status}.`,
      {
        status: response.status,
        code: metaError?.code,
        subcode: metaError?.error_subcode,
        type: metaError?.type,
        traceId: metaError?.fbtrace_id,
        userTitle: metaError?.error_user_title,
        userMessage: metaError?.error_user_msg,
        retryAfter: response.headers.get("retry-after"),
      },
    );
  }

  return body;
}

type PhoneNumberDetails = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

type MetaResource = { id: string; name?: string };

export type MetaAccountValidationInput = {
  phoneNumberId: string;
  wabaId: string;
  businessAccountId: string;
  accessToken: string;
};

export async function validateMetaAccountCredentials(
  input: MetaAccountValidationInput,
) {
  const [phone, waba, business] = await Promise.all([
    graphRequest<PhoneNumberDetails>(
      `${encodeURIComponent(input.phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
      input.accessToken,
    ),
    graphRequest<MetaResource>(
      `${encodeURIComponent(input.wabaId)}?fields=id,name`,
      input.accessToken,
    ),
    graphRequest<MetaResource>(
      `${encodeURIComponent(input.businessAccountId)}?fields=id,name`,
      input.accessToken,
    ),
  ]);

  if (
    phone.id !== input.phoneNumberId ||
    waba.id !== input.wabaId ||
    business.id !== input.businessAccountId
  ) {
    throw new MetaWhatsAppError("Os IDs retornados pela Meta nao correspondem aos IDs informados.", {
      status: 422,
    });
  }

  return {
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    qualityRating: phone.quality_rating ?? null,
  };
}

type MetaSendResponse = {
  messaging_product: "whatsapp";
  contacts?: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
};

export type MetaTemplateComponent = Record<string, unknown>;

export type CreateMetaTemplateInput = {
  name: string;
  language: string;
  category: TemplateCategory;
  components: MetaTemplateComponent[];
};

type MetaTemplateRecord = {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: MetaTemplateComponent[];
};

function mapTemplateStatus(status: string): TemplateStatus {
  if (status === "APPROVED") return "APPROVED";
  if (["REJECTED", "DISABLED", "PAUSED"].includes(status)) return "REJECTED";
  return "PENDING";
}

function mapTemplateCategory(category: string): TemplateCategory {
  if (category === "MARKETING" || category === "AUTHENTICATION") return category;
  return "UTILITY";
}

export class MetaWhatsAppService {
  private async getActiveAccount(accountId: string): Promise<WhatsAppAccount> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, status: "ACTIVE" },
    });

    if (!account) {
      throw new Error("Conta WhatsApp ativa nao encontrada.");
    }

    return account;
  }

  private sendMessage(
    account: WhatsAppAccount,
    payload: Record<string, unknown>,
  ) {
    return graphRequest<MetaSendResponse>(
      `${encodeURIComponent(account.phoneNumberId)}/messages`,
      account.accessToken,
      { method: "POST", body: JSON.stringify(payload) },
    );
  }

  async sendTextMessage(accountId: string, to: string, text: string) {
    const account = await this.getActiveAccount(accountId);
    return this.sendMessage(account, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    });
  }

  async sendTemplateMessage(
    accountId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponent[],
  ) {
    const account = await this.getActiveAccount(accountId);
    return this.sendMessage(account, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  async sendMediaMessage(
    accountId: string,
    to: string,
    type: "image" | "audio" | "document",
    mediaUrl: string,
    caption?: string,
  ) {
    const account = await this.getActiveAccount(accountId);
    const media: Record<string, unknown> = { link: mediaUrl };

    if (caption && type !== "audio") {
      media.caption = caption;
    }

    return this.sendMessage(account, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type,
      [type]: media,
    });
  }

  async markMessageAsRead(accountId: string, metaMessageId: string) {
    const account = await this.getActiveAccount(accountId);
    return graphRequest<{ success: boolean }>(
      `${encodeURIComponent(account.phoneNumberId)}/messages`,
      account.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: metaMessageId,
        }),
      },
    );
  }

  async syncTemplates(accountId: string) {
    const account = await this.getActiveAccount(accountId);
    let nextPage: string | undefined = `${encodeURIComponent(account.wabaId)}/message_templates?fields=id,name,language,category,status,components&limit=250`;
    const remoteTemplates: MetaTemplateRecord[] = [];

    for (let page = 0; nextPage && page < 50; page += 1) {
      const response: { data: MetaTemplateRecord[]; paging?: { next?: string } } =
        await graphRequest(nextPage, account.accessToken);
      remoteTemplates.push(...(response.data ?? []));
      nextPage = response.paging?.next;
    }
    const synced = [];

    for (const template of remoteTemplates) {
      const saved = await prisma.template.upsert({
        where: {
          tenantId_whatsappAccountId_name_language: {
            tenantId: account.tenantId,
            whatsappAccountId: account.id,
            name: template.name,
            language: template.language,
          },
        },
        create: {
          tenantId: account.tenantId,
          whatsappAccountId: account.id,
          name: template.name,
          language: template.language,
          category: mapTemplateCategory(template.category),
          status: mapTemplateStatus(template.status),
          components: template.components as Prisma.InputJsonValue,
          metaTemplateId: template.id,
        },
        update: {
          category: mapTemplateCategory(template.category),
          status: mapTemplateStatus(template.status),
          components: template.components as Prisma.InputJsonValue,
          metaTemplateId: template.id,
        },
      });
      synced.push(saved);
    }

    return synced;
  }

  async createTemplate(accountId: string, templateData: CreateMetaTemplateInput) {
    const account = await this.getActiveAccount(accountId);
    const response = await graphRequest<{ id: string; status?: string; category?: string }>(
      `${encodeURIComponent(account.wabaId)}/message_templates`,
      account.accessToken,
      { method: "POST", body: JSON.stringify(templateData) },
    );

    return prisma.template.upsert({
      where: {
        tenantId_whatsappAccountId_name_language: {
          tenantId: account.tenantId,
          whatsappAccountId: account.id,
          name: templateData.name,
          language: templateData.language,
        },
      },
      create: {
        tenantId: account.tenantId,
        whatsappAccountId: account.id,
        ...templateData,
        components: templateData.components as Prisma.InputJsonValue,
        status: mapTemplateStatus(response.status ?? "PENDING"),
        metaTemplateId: response.id,
      },
      update: {
        category: templateData.category,
        components: templateData.components as Prisma.InputJsonValue,
        status: mapTemplateStatus(response.status ?? "PENDING"),
        metaTemplateId: response.id,
      },
    });
  }

  async deleteTemplate(accountId: string, templateName: string) {
    const account = await this.getActiveAccount(accountId);
    await graphRequest<{ success: boolean }>(
      `${encodeURIComponent(account.wabaId)}/message_templates?name=${encodeURIComponent(templateName)}`,
      account.accessToken,
      { method: "DELETE" },
    );
    await prisma.template.deleteMany({
      where: { tenantId: account.tenantId, whatsappAccountId: account.id, name: templateName },
    });
    return { success: true };
  }
}

export const metaWhatsAppService = new MetaWhatsAppService();
