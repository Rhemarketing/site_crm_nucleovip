"use client";

import { ListChecks } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { MenuNodeData } from "@/types/bot-flow";

export function MenuNode({ data, selected }: NodeProps<Node<MenuNodeData, "menu">>) {
  return (
    <div className={`relative w-72 rounded-2xl border bg-white shadow-lg transition ${selected ? "border-violet-500 ring-4 ring-violet-100" : "border-violet-200"}`}>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-violet-500" />
      <div className="flex items-center gap-2 rounded-t-2xl bg-violet-600 px-4 py-3 text-white"><ListChecks className="size-4" /><strong className="text-sm">{data.label || "Menu"}</strong></div>
      <div className="p-4"><p className="line-clamp-3 text-xs text-slate-600">{data.question || "Escreva uma pergunta..."}</p><div className="mt-3 space-y-2">{data.options.map((option, index) => <div key={option.id} className="relative rounded-lg bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-800"><span className="mr-1.5 text-violet-400">{index + 1}.</span>{option.label}<Handle id={`option-${option.id}`} type="source" position={Position.Right} className="!right-[-22px] !size-3 !border-2 !border-white !bg-violet-500" /></div>)}<div className="relative rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-600">Resposta inválida<Handle id="fallback" type="source" position={Position.Right} className="!right-[-22px] !size-3 !border-2 !border-white !bg-rose-500" /></div></div></div>
    </div>
  );
}
