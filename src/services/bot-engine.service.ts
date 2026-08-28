import { Prisma } from "@prisma/client";

import { publishChatEvent } from "@/lib/chat-events";
import { serializeChatMessage } from "@/lib/chat-serializers";
import { isWithinBusinessHours } from "@/lib/business-hours";
import { prisma } from "@/lib/prisma";
import { metaWhatsAppService } from "@/services/meta-whatsapp.service";
import type {
  ActionNodeData,
  BotFlowEdge,
  BotFlowNode,
  ConditionNodeData,
  MenuNodeData,
  MessageNodeData,
  StartNodeData,
} from "@/types/bot-flow";

const BOT_TIMEZONE = process.env.BOT_TIMEZONE ?? "America/Sao_Paulo";
const MAX_CONSECUTIVE_NODES = 50;

function asNodes(value: unknown) {
  return Array.isArray(value) ? (value as BotFlowNode[]) : [];
}

function asEdges(value: unknown) {
  return Array.isArray(value) ? (value as BotFlowEdge[]) : [];
}

function asContext(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function nextEdge(edges: BotFlowEdge[], nodeId: string, sourceHandle?: string) {
  return edges.find(
    (edge) =>
      edge.source === nodeId &&
      (sourceHandle === undefined || edge.sourceHandle === sourceHandle),
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getLocalTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOT_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: weekdayMap[values.weekday] ?? 0,
    minutes: Number(values.hour ?? 0) * 60 + Number(values.minute ?? 0),
  };
}

function timeToMinutes(value = "00:00") {
  const [hour, minute] = value.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function formatMenu(data: MenuNodeData) {
  return [
    data.question,
    "",
    ...data.options.map((option, index) => `${index + 1}. ${option.label}`),
  ].join("\n");
}

class BotEngineService {
  private async processOutOfOffice(conversation: {
    id: string;
    tenantId: string;
    whatsappAccountId: string;
    botContext: Prisma.JsonValue | null;
    contact: { id: string; phone: string };
  }) {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: conversation.tenantId },
    });
    if (
      !settings?.isOutOfOfficeActive ||
      !settings.outOfOfficeMessage ||
      isWithinBusinessHours(settings.businessHours, settings.timezone)
    ) {
      return false;
    }

    const context = asContext(conversation.botContext);
    const lastSentAt =
      typeof context.outOfOfficeSentAt === "string"
        ? new Date(context.outOfOfficeSentAt).getTime()
        : 0;
    if (Date.now() - lastSentAt >= 24 * 60 * 60 * 1000) {
      await this.sendMessage({
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        whatsappAccountId: conversation.whatsappAccountId,
        phone: conversation.contact.phone,
        type: "TEXT",
        text: settings.outOfOfficeMessage,
        metadata: { automated: true, reason: "OUT_OF_OFFICE" },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          botContext: {
            ...context,
            outOfOfficeSentAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }
    return true;
  }

  private async sendMessage(input: {
    tenantId: string;
    conversationId: string;
    whatsappAccountId: string;
    phone: string;
    type: "TEXT" | "IMAGE" | "AUDIO";
    text: string;
    mediaUrl?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const result =
      input.type === "TEXT"
        ? await metaWhatsAppService.sendTextMessage(
            input.whatsappAccountId,
            input.phone,
            input.text,
          )
        : await metaWhatsAppService.sendMediaMessage(
            input.whatsappAccountId,
            input.phone,
            input.type.toLowerCase() as "image" | "audio",
            input.mediaUrl ?? "",
            input.type === "IMAGE" ? input.text : undefined,
          );
    const metaMessageId = result.messages[0]?.id;
    if (!metaMessageId)
      throw new Error("A Meta não retornou o ID da mensagem do bot.");

    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          metaMessageId,
          direction: "OUTBOUND",
          type: input.type,
          content: input.text,
          mediaUrl: input.mediaUrl,
          status: "SENT",
          metadata: input.metadata,
        },
      });
      await transaction.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });

    const occurredAt = new Date().toISOString();
    await Promise.all([
      publishChatEvent({
        type: "NEW_MESSAGE",
        tenantId: input.tenantId,
        occurredAt,
        data: {
          conversationId: input.conversationId,
          message: serializeChatMessage(message),
        },
      }),
      publishChatEvent({
        type: "CONVERSATION_UPDATED",
        tenantId: input.tenantId,
        occurredAt,
        data: { conversationId: input.conversationId },
      }),
    ]);
  }

  private async chooseFlow(tenantId: string, messageContent: string) {
    const flows = await prisma.botFlow.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: "asc" }, { updatedAt: "desc" }],
    });
    const incoming = normalize(messageContent);
    const keywordFlow = flows.find(
      (flow) =>
        flow.triggerKeyword &&
        incoming.includes(normalize(flow.triggerKeyword)),
    );
    if (keywordFlow) return keywordFlow;

    const outsideHoursFlow = flows.find((flow) => {
      const start = asNodes(flow.nodes).find((node) => node.type === "start");
      const data = start?.data as StartNodeData | undefined;
      if (data?.triggerType !== "OUTSIDE_HOURS") return false;
      const { weekday, minutes } = getLocalTime();
      return (
        ![1, 2, 3, 4, 5].includes(weekday) ||
        minutes < 8 * 60 ||
        minutes > 18 * 60
      );
    });
    return outsideHoursFlow ?? flows.find((flow) => flow.isDefault) ?? null;
  }

  private async evaluateCondition(
    data: ConditionNodeData,
    contactId: string,
    tenantId: string,
  ) {
    if (data.conditionType === "CONTACT_HAS_TAG") {
      if (!data.tagId) return false;
      return Boolean(
        await prisma.contactTag.findFirst({
          where: { tenantId, contactId, tagId: data.tagId },
          select: { id: true },
        }),
      );
    }
    const { weekday, minutes } = getLocalTime();
    const weekdays = data.weekdays?.length ? data.weekdays : [1, 2, 3, 4, 5];
    return (
      weekdays.includes(weekday) &&
      minutes >= timeToMinutes(data.startTime ?? "08:00") &&
      minutes <= timeToMinutes(data.endTime ?? "18:00")
    );
  }

  private async executeAction(input: {
    data: ActionNodeData;
    tenantId: string;
    conversationId: string;
    contactId: string;
  }) {
    const { data, tenantId, conversationId, contactId } = input;
    if (data.actionType === "ADD_TAG" && data.tagId) {
      const tag = await prisma.tag.findFirst({
        where: { id: data.tagId, tenantId },
      });
      if (tag) {
        await prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId, tagId: tag.id } },
          create: { tenantId, contactId, tagId: tag.id },
          update: {},
        });
      }
    } else if (data.actionType === "REMOVE_TAG" && data.tagId) {
      await prisma.contactTag.deleteMany({
        where: { tenantId, contactId, tagId: data.tagId },
      });
    } else if (data.actionType === "ASSIGN_USER" && data.userId) {
      const user = await prisma.user.findFirst({
        where: { id: data.userId, tenantId },
      });
      if (user) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { assignedUserId: user.id, status: "OPEN" },
        });
      }
    } else if (data.actionType === "CLOSE_CONVERSATION") {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "CLOSED", botActive: false },
      });
      return false;
    } else if (data.actionType === "PAUSE_BOT") {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { botActive: false, status: "PENDING" },
      });
      return false;
    }
    return true;
  }

  async processIncomingMessage(
    tenantId: string,
    conversationId: string,
    messageContent: string,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: { select: { id: true, phone: true } } },
    });
    if (!conversation) return;
    if (await this.processOutOfOffice(conversation)) return;
    if (!conversation.botActive) return;

    let flow = conversation.currentBotFlowId
      ? await prisma.botFlow.findFirst({
          where: {
            id: conversation.currentBotFlowId,
            tenantId,
            isActive: true,
          },
        })
      : null;
    let currentNodeId = conversation.currentNodeId;
    let context = asContext(conversation.botContext);

    if (!flow) {
      flow = await this.chooseFlow(tenantId, messageContent);
      if (!flow) return;
      const nodes = asNodes(flow.nodes);
      const edges = asEdges(flow.edges);
      const start = nodes.find((node) => node.type === "start");
      const first = start ? nextEdge(edges, start.id) : null;
      if (!first) return;
      currentNodeId = first.target;
      context = context.outOfOfficeSentAt
        ? { outOfOfficeSentAt: context.outOfOfficeSentAt }
        : {};
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentBotFlowId: flow.id,
          currentNodeId,
          botContext: {},
        },
      });
    } else if (currentNodeId) {
      const nodes = asNodes(flow.nodes);
      const edges = asEdges(flow.edges);
      const current = nodes.find((node) => node.id === currentNodeId);
      if (current?.type === "menu") {
        const data = current.data as MenuNodeData;
        const answer = normalize(messageContent);
        const option = data.options.find(
          (item, index) =>
            answer === String(index + 1) ||
            answer === normalize(item.label) ||
            answer === normalize(item.value),
        );
        if (option) {
          const edge = nextEdge(edges, current.id, `option-${option.id}`);
          if (!edge) return;
          currentNodeId = edge.target;
          context = { ...context, [`menu:${current.id}`]: 0 };
        } else {
          const attemptKey = `menu:${current.id}`;
          const attempts = Number(context[attemptKey] ?? 0) + 1;
          context = { ...context, [attemptKey]: attempts };
          const fallbackEdge = nextEdge(edges, current.id, "fallback");
          if (attempts >= Math.max(1, data.maxAttempts) && fallbackEdge) {
            currentNodeId = fallbackEdge.target;
          } else {
            await this.sendMessage({
              tenantId,
              conversationId,
              whatsappAccountId: conversation.whatsappAccountId,
              phone: conversation.contact.phone,
              type: "TEXT",
              text: `${data.fallbackMessage}\n\n${formatMenu(data)}`,
              metadata: { botFlowId: flow.id, botNodeId: current.id },
            });
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { botContext: context as Prisma.InputJsonValue },
            });
            return;
          }
        }
      }
    }

    const nodes = asNodes(flow.nodes);
    const edges = asEdges(flow.edges);
    for (
      let step = 0;
      currentNodeId && step < MAX_CONSECUTIVE_NODES;
      step += 1
    ) {
      const node = nodes.find((item) => item.id === currentNodeId);
      if (!node) break;

      if (node.type === "message") {
        const data = node.data as MessageNodeData;
        const delay = Math.min(10_000, Math.max(0, data.typingDelayMs || 0));
        if (delay) await wait(delay);
        if (data.messageType !== "TEXT" && !data.mediaUrl) {
          throw new Error(`O nó ${node.id} não possui URL de mídia.`);
        }
        await this.sendMessage({
          tenantId,
          conversationId,
          whatsappAccountId: conversation.whatsappAccountId,
          phone: conversation.contact.phone,
          type: data.messageType,
          text: data.text,
          mediaUrl: data.mediaUrl,
          metadata: { botFlowId: flow.id, botNodeId: node.id },
        });
        currentNodeId = nextEdge(edges, node.id)?.target ?? null;
      } else if (node.type === "menu") {
        const data = node.data as MenuNodeData;
        await this.sendMessage({
          tenantId,
          conversationId,
          whatsappAccountId: conversation.whatsappAccountId,
          phone: conversation.contact.phone,
          type: "TEXT",
          text: formatMenu(data),
          metadata: { botFlowId: flow.id, botNodeId: node.id },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            currentBotFlowId: flow.id,
            currentNodeId: node.id,
            botContext: context as Prisma.InputJsonValue,
          },
        });
        await publishChatEvent({
          type: "CONVERSATION_UPDATED",
          tenantId,
          occurredAt: new Date().toISOString(),
          data: { conversationId },
        });
        return;
      } else if (node.type === "action") {
        const shouldContinue = await this.executeAction({
          data: node.data as ActionNodeData,
          tenantId,
          conversationId,
          contactId: conversation.contact.id,
        });
        if (!shouldContinue) {
          currentNodeId = null;
          break;
        }
        currentNodeId = nextEdge(edges, node.id)?.target ?? null;
      } else if (node.type === "condition") {
        const result = await this.evaluateCondition(
          node.data as ConditionNodeData,
          conversation.contact.id,
          tenantId,
        );
        currentNodeId =
          nextEdge(edges, node.id, result ? "true" : "false")?.target ?? null;
      } else {
        currentNodeId = nextEdge(edges, node.id)?.target ?? null;
      }
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: currentNodeId
        ? {
            currentBotFlowId: flow.id,
            currentNodeId,
            botContext: context as Prisma.InputJsonValue,
          }
        : {
            botActive: false,
            currentBotFlowId: null,
            currentNodeId: null,
            botContext: context.outOfOfficeSentAt
              ? ({ outOfOfficeSentAt: context.outOfOfficeSentAt } as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
    });
    await publishChatEvent({
      type: "CONVERSATION_UPDATED",
      tenantId,
      occurredAt: new Date().toISOString(),
      data: { conversationId },
    });
  }
}

export const botEngineService = new BotEngineService();
