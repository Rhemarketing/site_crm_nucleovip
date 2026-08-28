"use client";

import { Play } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { StartNodeData } from "@/types/bot-flow";

const triggerLabels = {
  ANY_MESSAGE: "Qualquer primeira mensagem",
  KEYWORD: "Palavra-chave específica",
  OUTSIDE_HOURS: "Fora do horário",
};

export function StartNode({ data, selected }: NodeProps<Node<StartNodeData, "start">>) {
  return (
    <div className={`w-64 rounded-2xl border bg-white shadow-lg transition ${selected ? "border-emerald-500 ring-4 ring-emerald-100" : "border-emerald-200"}`}>
      <div className="flex items-center gap-2 rounded-t-2xl bg-emerald-600 px-4 py-3 text-white">
        <Play className="size-4 fill-current" />
        <strong className="text-sm">{data.label || "Início"}</strong>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gatilho</p>
        <p className="mt-1 text-xs font-semibold text-slate-700">{triggerLabels[data.triggerType]}</p>
        {data.triggerType === "KEYWORD" && data.triggerKeyword && <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{data.triggerKeyword}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-white !bg-emerald-500" />
    </div>
  );
}
