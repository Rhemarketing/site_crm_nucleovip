"use client";

import { ImageIcon, MessageSquareText, Music2 } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { MessageNodeData } from "@/types/bot-flow";

const icons = { TEXT: MessageSquareText, IMAGE: ImageIcon, AUDIO: Music2 };

export function MessageNode({ data, selected }: NodeProps<Node<MessageNodeData, "message">>) {
  const Icon = icons[data.messageType];
  return <div className={`relative w-64 rounded-2xl border bg-white shadow-lg transition ${selected ? "border-sky-500 ring-4 ring-sky-100" : "border-sky-200"}`}><Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-sky-500" /><div className="flex items-center gap-2 rounded-t-2xl bg-sky-600 px-4 py-3 text-white"><Icon className="size-4" /><strong className="text-sm">{data.label || "Mensagem"}</strong></div><div className="p-4"><p className="line-clamp-4 whitespace-pre-wrap text-xs text-slate-600">{data.text || "Digite a mensagem..."}</p>{data.typingDelayMs > 0 && <p className="mt-3 text-[10px] font-semibold text-slate-400">Espera de {data.typingDelayMs / 1000}s</p>}</div><Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-white !bg-sky-500" /></div>;
}
