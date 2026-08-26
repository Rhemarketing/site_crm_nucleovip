import type { Message } from "@prisma/client";

import type { ChatConversationDto, ChatMessageDto } from "@/types/chat";

export function serializeChatMessage(message: Message): ChatMessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    metaMessageId: message.metaMessageId,
    direction: message.direction,
    type: message.type,
    content: message.content,
    mediaUrl: message.mediaUrl,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  };
}

type ConversationWithRelations = {
  id: string;
  status: ChatConversationDto["status"];
  lastMessageAt: Date;
  unreadCount: number;
  is24hWindowActive: boolean;
  windowExpiresAt: Date | null;
  createdAt: Date;
  contact: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    contactTags: Array<{ tag: { id: string; name: string; color: string } }>;
  };
  whatsappAccount: { id: string; name: string; phoneNumberId: string };
  assignedUser: { id: string; name: string; email: string } | null;
  assignmentHistory: Array<{
    id: string;
    createdAt: Date;
    assignedUser: { id: string; name: string } | null;
    assignedByUser: { id: string; name: string };
  }>;
  messages: Message[];
};

export function serializeConversation(
  conversation: ConversationWithRelations,
): ChatConversationDto {
  const lastMessage = conversation.messages[0];
  const windowActive =
    conversation.is24hWindowActive &&
    Boolean(
      conversation.windowExpiresAt && conversation.windowExpiresAt > new Date(),
    );

  return {
    id: conversation.id,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unreadCount: conversation.unreadCount,
    is24hWindowActive: windowActive,
    windowExpiresAt: conversation.windowExpiresAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    contact: {
      id: conversation.contact.id,
      name: conversation.contact.name,
      phone: conversation.contact.phone,
      email: conversation.contact.email,
      avatarUrl: conversation.contact.avatarUrl,
      createdAt: conversation.contact.createdAt.toISOString(),
      tags: conversation.contact.contactTags.map(({ tag }) => tag),
    },
    whatsappAccount: conversation.whatsappAccount,
    assignedUser: conversation.assignedUser,
    assignmentHistory: conversation.assignmentHistory.map((assignment) => ({
      ...assignment,
      createdAt: assignment.createdAt.toISOString(),
    })),
    lastMessage: lastMessage ? serializeChatMessage(lastMessage) : null,
  };
}
