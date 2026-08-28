import type { BotFlowEdge, BotFlowNode } from "@/types/bot-flow";

export class BotFlowValidationError extends Error {}

export function parseBotGraph(nodesValue: unknown, edgesValue: unknown) {
  if (!Array.isArray(nodesValue) || !Array.isArray(edgesValue)) {
    throw new BotFlowValidationError("Nós e conexões devem ser listas válidas.");
  }
  if (nodesValue.length > 200 || edgesValue.length > 500) {
    throw new BotFlowValidationError("O fluxo excedeu o limite de tamanho.");
  }

  const nodes = nodesValue as BotFlowNode[];
  const edges = edgesValue as BotFlowEdge[];
  const ids = new Set(nodes.map((node) => node.id));
  const starts = nodes.filter((node) => node.type === "start");

  if (starts.length !== 1) {
    throw new BotFlowValidationError("O fluxo deve possuir exatamente um nó inicial.");
  }
  if (!edges.some((edge) => edge.source === starts[0].id)) {
    throw new BotFlowValidationError("Conecte o nó inicial ao primeiro passo do fluxo.");
  }
  if (nodes.some((node) => !node.id || !node.type || !node.data || !node.position)) {
    throw new BotFlowValidationError("Existe um nó incompleto no fluxo.");
  }
  if (edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) {
    throw new BotFlowValidationError("Existe uma conexão apontando para um nó inexistente.");
  }

  return { nodes, edges };
}

export function createInitialBotGraph() {
  const nodes: BotFlowNode[] = [
    {
      id: "start",
      type: "start",
      position: { x: 80, y: 180 },
      data: { label: "Início", triggerType: "ANY_MESSAGE" },
    },
    {
      id: "welcome",
      type: "message",
      position: { x: 420, y: 180 },
      data: {
        label: "Boas-vindas",
        messageType: "TEXT",
        text: "Olá! Como podemos ajudar você hoje?",
        typingDelayMs: 500,
      },
    },
  ];
  const edges: BotFlowEdge[] = [
    { id: "start-welcome", source: "start", target: "welcome" },
  ];
  return { nodes, edges };
}
