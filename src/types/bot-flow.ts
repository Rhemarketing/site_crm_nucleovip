import type { Edge, Node } from "@xyflow/react";

export type BotNodeKind = "start" | "menu" | "message" | "action" | "condition";

export interface StartNodeData extends Record<string, unknown> {
  label: string;
  triggerType: "ANY_MESSAGE" | "KEYWORD" | "OUTSIDE_HOURS";
  triggerKeyword?: string;
}

export type MenuOption = { id: string; label: string; value: string };

export interface MenuNodeData extends Record<string, unknown> {
  label: string;
  question: string;
  options: MenuOption[];
  fallbackMessage: string;
  maxAttempts: number;
}

export interface MessageNodeData extends Record<string, unknown> {
  label: string;
  messageType: "TEXT" | "IMAGE" | "AUDIO";
  text: string;
  mediaUrl?: string;
  typingDelayMs: number;
}

export type BotActionType =
  | "ASSIGN_USER"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "CLOSE_CONVERSATION"
  | "PAUSE_BOT";

export interface ActionNodeData extends Record<string, unknown> {
  label: string;
  actionType: BotActionType;
  userId?: string;
  tagId?: string;
}

export type ConditionType = "BUSINESS_HOURS" | "CONTACT_HAS_TAG";

export interface ConditionNodeData extends Record<string, unknown> {
  label: string;
  conditionType: ConditionType;
  startTime?: string;
  endTime?: string;
  weekdays?: number[];
  tagId?: string;
}

export type BotNodeData =
  | StartNodeData
  | MenuNodeData
  | MessageNodeData
  | ActionNodeData
  | ConditionNodeData;

export type BotFlowNode = Node<BotNodeData, BotNodeKind>;
export type BotFlowEdge = Edge;

export type BotFlowDto = {
  id: string;
  name: string;
  triggerKeyword: string | null;
  isDefault: boolean;
  isActive: boolean;
  nodes: BotFlowNode[];
  edges: BotFlowEdge[];
  createdAt: string;
  updatedAt: string;
};
