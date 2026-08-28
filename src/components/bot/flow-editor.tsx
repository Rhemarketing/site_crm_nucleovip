"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  GitBranch,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";

import { ActionNode, ConditionNode, MenuNode, MessageNode, StartNode } from "@/components/bot/nodes";
import { cn } from "@/lib/utils";
import type {
  ActionNodeData,
  BotActionType,
  BotFlowEdge,
  BotFlowDto,
  BotFlowNode,
  BotNodeData,
  BotNodeKind,
  ConditionNodeData,
  MenuNodeData,
  MessageNodeData,
  StartNodeData,
} from "@/types/bot-flow";

type ResourceTag = { id: string; name: string; color: string };
type ResourceUser = { id: string; name: string; email: string; role: string };

const nodeTypes = {
  start: StartNode,
  menu: MenuNode,
  message: MessageNode,
  action: ActionNode,
  condition: ConditionNode,
} satisfies NodeTypes;

const palette = [
  { type: "menu" as const, label: "Menu", description: "Pergunta com opções", icon: ListChecks, color: "text-violet-600 bg-violet-50" },
  { type: "message" as const, label: "Mensagem", description: "Texto, imagem ou áudio", icon: MessageSquareText, color: "text-sky-600 bg-sky-50" },
  { type: "action" as const, label: "Ação", description: "Etiqueta ou atendente", icon: Zap, color: "text-amber-600 bg-amber-50" },
  { type: "condition" as const, label: "Condição", description: "Crie dois caminhos", icon: GitBranch, color: "text-fuchsia-600 bg-fuchsia-50" },
];

function newNode(type: Exclude<BotNodeKind, "start">, x: number, y: number): BotFlowNode {
  const id = `${type}-${crypto.randomUUID()}`;
  const dataByType: Record<Exclude<BotNodeKind, "start">, BotNodeData> = {
    menu: { label: "Novo menu", question: "Como podemos ajudar?", options: [{ id: crypto.randomUUID(), label: "Suporte", value: "suporte" }, { id: crypto.randomUUID(), label: "Comercial", value: "comercial" }], fallbackMessage: "Opção inválida. Digite o número de uma das opções.", maxAttempts: 3 },
    message: { label: "Nova mensagem", messageType: "TEXT", text: "Digite sua mensagem aqui.", typingDelayMs: 500 },
    action: { label: "Nova ação", actionType: "PAUSE_BOT" },
    condition: { label: "Nova condição", conditionType: "BUSINESS_HOURS", startTime: "08:00", endTime: "18:00", weekdays: [1, 2, 3, 4, 5] },
  };
  return { id, type, position: { x, y }, data: dataByType[type] };
}

function PropertiesPanel({
  node,
  tags,
  users,
  onChange,
  onDelete,
  onClose,
}: {
  node: BotFlowNode;
  tags: ResourceTag[];
  users: ResourceUser[];
  onChange: (data: Partial<BotNodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500";
  return (
    <aside className="absolute inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Propriedades</p><h2 className="font-bold">Configurar nó</h2></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="size-5" /></button></header>
      <div className="space-y-5 p-5">
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Nome interno</span><input value={String(node.data.label ?? "")} onChange={(event) => onChange({ label: event.target.value })} className={inputClass} /></label>
        {node.type === "start" && (() => { const data = node.data as StartNodeData; return <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Gatilho inicial</span><select value={data.triggerType} onChange={(event) => onChange({ triggerType: event.target.value as StartNodeData["triggerType"] })} className={inputClass}><option value="ANY_MESSAGE">Qualquer primeira mensagem</option><option value="KEYWORD">Palavra-chave específica</option><option value="OUTSIDE_HOURS">Fora do horário</option></select></label>{data.triggerType === "KEYWORD" && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Palavra-chave</span><input value={data.triggerKeyword ?? ""} onChange={(event) => onChange({ triggerKeyword: event.target.value })} className={inputClass} /></label>}</>; })()}
        {node.type === "message" && (() => { const data = node.data as MessageNodeData; return <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo</span><select value={data.messageType} onChange={(event) => onChange({ messageType: event.target.value as MessageNodeData["messageType"] })} className={inputClass}><option value="TEXT">Texto</option><option value="IMAGE">Imagem</option><option value="AUDIO">Áudio</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Mensagem ou legenda</span><textarea rows={6} value={data.text} onChange={(event) => onChange({ text: event.target.value })} className={inputClass} /></label>{data.messageType !== "TEXT" && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">URL da mídia</span><input value={data.mediaUrl ?? ""} onChange={(event) => onChange({ mediaUrl: event.target.value })} className={inputClass} /></label>}<label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Espera de digitação (ms)</span><input type="number" min={0} max={10000} step={100} value={data.typingDelayMs} onChange={(event) => onChange({ typingDelayMs: Number(event.target.value) })} className={inputClass} /></label></>; })()}
        {node.type === "menu" && (() => { const data = node.data as MenuNodeData; return <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Pergunta</span><textarea rows={4} value={data.question} onChange={(event) => onChange({ question: event.target.value })} className={inputClass} /></label><div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Opções</span><button onClick={() => onChange({ options: [...data.options, { id: crypto.randomUUID(), label: `Opção ${data.options.length + 1}`, value: `opcao-${data.options.length + 1}` }] })} className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus className="size-3.5" />Adicionar</button></div><div className="space-y-2">{data.options.map((option, index) => <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">{index + 1}</span><input value={option.label} onChange={(event) => onChange({ options: data.options.map((item) => item.id === option.id ? { ...item, label: event.target.value, value: event.target.value.toLowerCase() } : item) })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button onClick={() => onChange({ options: data.options.filter((item) => item.id !== option.id) })} className="rounded p-1 text-rose-500"><Trash2 className="size-4" /></button></div>)}</div></div><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Resposta inválida</span><textarea rows={3} value={data.fallbackMessage} onChange={(event) => onChange({ fallbackMessage: event.target.value })} className={inputClass} /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Máximo de tentativas</span><input type="number" min={1} max={10} value={data.maxAttempts} onChange={(event) => onChange({ maxAttempts: Number(event.target.value) })} className={inputClass} /></label></>; })()}
        {node.type === "action" && (() => { const data = node.data as ActionNodeData; return <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Ação</span><select value={data.actionType} onChange={(event) => onChange({ actionType: event.target.value as BotActionType, userId: undefined, tagId: undefined })} className={inputClass}><option value="ASSIGN_USER">Atribuir atendente</option><option value="ADD_TAG">Adicionar etiqueta</option><option value="REMOVE_TAG">Remover etiqueta</option><option value="CLOSE_CONVERSATION">Finalizar atendimento</option><option value="PAUSE_BOT">Pausar bot e transferir</option></select></label>{data.actionType === "ASSIGN_USER" && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Atendente</span><select value={data.userId ?? ""} onChange={(event) => onChange({ userId: event.target.value })} className={inputClass}><option value="">Selecione</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></label>}{["ADD_TAG", "REMOVE_TAG"].includes(data.actionType) && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Etiqueta</span><select value={data.tagId ?? ""} onChange={(event) => onChange({ tagId: event.target.value })} className={inputClass}><option value="">Selecione</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>}</>; })()}
        {node.type === "condition" && (() => { const data = node.data as ConditionNodeData; return <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Regra</span><select value={data.conditionType} onChange={(event) => onChange({ conditionType: event.target.value as ConditionNodeData["conditionType"] })} className={inputClass}><option value="BUSINESS_HOURS">Horário de atendimento</option><option value="CONTACT_HAS_TAG">Contato possui etiqueta</option></select></label>{data.conditionType === "BUSINESS_HOURS" ? <div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Início</span><input type="time" value={data.startTime ?? "08:00"} onChange={(event) => onChange({ startTime: event.target.value })} className={inputClass} /></label><label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Fim</span><input type="time" value={data.endTime ?? "18:00"} onChange={(event) => onChange({ endTime: event.target.value })} className={inputClass} /></label></div> : <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Etiqueta</span><select value={data.tagId ?? ""} onChange={(event) => onChange({ tagId: event.target.value })} className={inputClass}><option value="">Selecione</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>}</>; })()}
        {node.type !== "start" && <button onClick={onDelete} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" />Excluir nó</button>}
      </div>
    </aside>
  );
}

function FlowEditorCanvas({ flowId }: { flowId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BotFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BotFlowEdge>([]);
  const [flow, setFlow] = useState<BotFlowDto | null>(null);
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [users, setUsers] = useState<ResourceUser[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    fetch(`/api/bot-flows/${flowId}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ flow?: BotFlowDto; resources?: { tags: ResourceTag[]; users: ResourceUser[] }; error?: string }>)
      .then((data) => {
        if (!data.flow) throw new Error(data.error ?? "Fluxo não encontrado.");
        setFlow(data.flow); setNodes(data.flow.nodes); setEdges(data.flow.edges); setTags(data.resources?.tags ?? []); setUsers(data.resources?.users ?? []);
      })
      .catch((reason: Error) => setMessage(reason.message))
      .finally(() => setLoading(false));
  }, [flowId, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) => addEdge(connection, current)),
    [setEdges],
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const updateSelected = (patch: Partial<BotNodeData>) => setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } as BotNodeData } : node));
  const deleteSelected = () => { if (!selectedNodeId) return; setNodes((current) => current.filter((node) => node.id !== selectedNodeId)); setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)); setSelectedNodeId(null); };

  function addNode(type: Exclude<BotNodeKind, "start">, position?: { x: number; y: number }) {
    const fallback = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const node = newNode(type, position?.x ?? fallback.x, position?.y ?? fallback.y);
    setNodes((current) => [...current, node]); setSelectedNodeId(node.id);
  }

  async function save() {
    if (!flow) return;
    const start = nodes.find((node) => node.type === "start");
    if (!start || !edges.some((edge) => edge.source === start.id)) { setMessage("Conecte o nó inicial ao primeiro passo antes de publicar."); return; }
    setSaving(true); setMessage(null);
    const startData = start.data as StartNodeData;
    const response = await fetch(`/api/bot-flows/${flow.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: flow.name, triggerKeyword: startData.triggerType === "KEYWORD" ? startData.triggerKeyword : null, isActive: flow.isActive, isDefault: flow.isDefault, nodes, edges }) });
    const data = (await response.json()) as { flow?: BotFlowDto; error?: string };
    setSaving(false);
    if (!response.ok || !data.flow) { setMessage(data.error ?? "Não foi possível salvar."); return; }
    setFlow(data.flow); setMessage("Fluxo salvo e publicado com sucesso.");
  }

  if (loading) return <div className="grid h-[calc(100dvh-4rem)] place-items-center bg-slate-50"><LoaderCircle className="size-8 animate-spin text-emerald-600" /></div>;
  if (!flow) return <div className="grid h-[calc(100dvh-4rem)] place-items-center bg-slate-50"><p className="text-sm text-rose-600">{message}</p></div>;

  return <main className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-slate-100"><header className="z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"><Link href="/dashboard/bot" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft className="size-5" /></Link><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Bot className="size-5" /></span><input value={flow.name} onChange={(event) => setFlow({ ...flow, name: event.target.value })} className="min-w-40 flex-1 bg-transparent text-sm font-bold outline-none sm:text-base" /><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={flow.isActive} onChange={(event) => setFlow({ ...flow, isActive: event.target.checked })} className="size-4 accent-emerald-600" />Fluxo ativo</label><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={flow.isDefault} onChange={(event) => setFlow({ ...flow, isDefault: event.target.checked })} className="size-4 accent-amber-500" />Fluxo padrão</label><button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Salvar e publicar</button></header>{message && <div className={cn("z-30 flex items-center justify-between border-b px-4 py-2 text-xs", message.includes("sucesso") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")}><span className="flex items-center gap-2">{message.includes("sucesso") && <Check className="size-4" />}{message}</span><button onClick={() => setMessage(null)}><X className="size-4" /></button></div>}<div className="relative min-h-0 flex-1" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/bot-node") as Exclude<BotNodeKind, "start">; if (!type) return; const point = screenToFlowPosition({ x: event.clientX, y: event.clientY }); addNode(type, point); }}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(null)} fitView minZoom={0.2} maxZoom={1.5} deleteKeyCode={["Backspace", "Delete"]} colorMode="light" defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }}><Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" /><Controls position="bottom-left" /><MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => ({ start: "#10b981", menu: "#7c3aed", message: "#0284c7", action: "#f59e0b", condition: "#c026d3" })[node.type ?? "message"] ?? "#64748b"} /><div className="absolute left-4 top-4 z-10 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Adicionar etapa</p><div className="space-y-1">{palette.map((item) => <button key={item.type} draggable onDragStart={(event) => { event.dataTransfer.setData("application/bot-node", item.type); event.dataTransfer.effectAllowed = "move"; }} onClick={() => addNode(item.type)} className="flex w-full cursor-grab items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50 active:cursor-grabbing"><span className={cn("grid size-9 place-items-center rounded-lg", item.color)}><item.icon className="size-4" /></span><span><strong className="block text-xs">{item.label}</strong><small className="text-[10px] text-slate-400">{item.description}</small></span></button>)}</div></div></ReactFlow>{selectedNode && <PropertiesPanel node={selectedNode} tags={tags} users={users} onChange={updateSelected} onDelete={deleteSelected} onClose={() => setSelectedNodeId(null)} />}</div></main>;
}

export function FlowEditor({ flowId }: { flowId: string }) {
  return <ReactFlowProvider><FlowEditorCanvas flowId={flowId} /></ReactFlowProvider>;
}
