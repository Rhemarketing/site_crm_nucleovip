"use client";

import { GitBranch } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { ConditionNodeData } from "@/types/bot-flow";

export function ConditionNode({ data, selected }: NodeProps<Node<ConditionNodeData, "condition">>) {
  return <div className={`relative w-72 rounded-2xl border bg-white shadow-lg transition ${selected ? "border-fuchsia-500 ring-4 ring-fuchsia-100" : "border-fuchsia-200"}`}><Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-fuchsia-500" /><div className="flex items-center gap-2 rounded-t-2xl bg-fuchsia-600 px-4 py-3 text-white"><GitBranch className="size-4" /><strong className="text-sm">{data.label || "Condição"}</strong></div><div className="p-4"><p className="text-xs font-semibold text-slate-700">{data.conditionType === "BUSINESS_HOURS" ? "Está dentro do horário?" : "Contato possui etiqueta?"}</p><div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px] font-bold"><div className="relative rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700">Verdadeiro<Handle id="true" type="source" position={Position.Bottom} className="!size-3 !border-2 !border-white !bg-emerald-500" /></div><div className="relative rounded-lg bg-rose-50 px-2 py-2 text-rose-700">Falso<Handle id="false" type="source" position={Position.Bottom} className="!size-3 !border-2 !border-white !bg-rose-500" /></div></div></div></div>;
}
