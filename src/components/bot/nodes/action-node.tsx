"use client";

import { Zap } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { ActionNodeData } from "@/types/bot-flow";

const labels = { ASSIGN_USER: "Atribuir atendente", ADD_TAG: "Adicionar etiqueta", REMOVE_TAG: "Remover etiqueta", CLOSE_CONVERSATION: "Finalizar atendimento", PAUSE_BOT: "Transferir para humano" };

export function ActionNode({ data, selected }: NodeProps<Node<ActionNodeData, "action">>) {
  return <div className={`relative w-64 rounded-2xl border bg-white shadow-lg transition ${selected ? "border-amber-500 ring-4 ring-amber-100" : "border-amber-200"}`}><Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-amber-500" /><div className="flex items-center gap-2 rounded-t-2xl bg-amber-500 px-4 py-3 text-white"><Zap className="size-4 fill-current" /><strong className="text-sm">{data.label || "Ação"}</strong></div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Executar</p><p className="mt-1 text-xs font-semibold text-slate-700">{labels[data.actionType]}</p></div><Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-white !bg-amber-500" /></div>;
}
