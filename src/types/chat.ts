export type ChatMessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
export type ChatMessageType =
  | "TEXT"
  | "IMAGE"
  | "AUDIO"
  | "DOCUMENT"
  | "TEMPLATE"
  | "INTERACTIVE";
export type ChatConversationStatus = "OPEN" | "PENDING" | "CLOSED";

export type ChatMessageDto = {
  id: string;
  conversationId: string;
  metaMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  type: ChatMessageType;
  content: string;
  mediaUrl: string | null;
  status: ChatMessageStatus;
  createdAt: string;
};

export type ChatConversationDto = {
  id: string;
  status: ChatConversationStatus;
  lastMessageAt: string;
  unreadCount: number;
  is24hWindowActive: boolean;
  windowExpiresAt: string | null;
  createdAt: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    avatarUrl: string | null;
    createdAt: string;
    tags: Array<{ id: string; name: string; color: string }>;
  };
  whatsappAccount: {
    id: string;
    name: string;
    phoneNumberId: string;
  };
  assignedUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignmentHistory: Array<{
    id: string;
    createdAt: string;
    assignedUser: { id: string; name: string } | null;
    assignedByUser: { id: string; name: string };
  }>;
  lastMessage: ChatMessageDto | null;
};

export type ChatEvent =
  | {
      type: "NEW_MESSAGE";
      tenantId: string;
      occurredAt: string;
      data: { conversationId: string; message: ChatMessageDto };
    }
  | {
      type: "MESSAGE_STATUS_UPDATED";
      tenantId: string;
      occurredAt: string;
      data: {
        conversationId: string;
        messageId: string;
        metaMessageId: string | null;
        status: ChatMessageStatus;
      };
    }
  | {
      type: "CONVERSATION_UPDATED";
      tenantId: string;
      occurredAt: string;
      data: { conversationId: string };
    }
  | {
      type: "CAMPAIGN_PROGRESS";
      tenantId: string;
      occurredAt: string;
      data: {
        campaignId: string;
        status:
          | "DRAFT"
          | "QUEUED"
          | "PROCESSING"
          | "COMPLETED"
          | "FAILED"
          | "CANCELLED";
        sentCount: number;
        deliveredCount: number;
        readCount: number;
        failedCount: number;
        totalRecipients: number;
        percentage: number;
      };
    };
