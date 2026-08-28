"use client";

import { Bot, CirclePower, LoaderCircle, Pencil, Plus, Star, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Flow = {
  id: string;
  name: string;
  triggerKeyword: string | null;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
  _count: { conversations: number };
};

export function BotFlowsManager() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/bot-flows", { cache: "no-store" });
    const data = (await response.json()) as { flows?: Flow[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os fluxos.");
    setFlows(data.flows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((reason: Error) => setError(reason.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    const response = await fetch("/api/bot-flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo fluxo de atendimento" }),
    });
    const data = (await response.json()) as { flow?: Flow; error?: string };
    setCreating(false);
    if (!response.ok || !data.flow) {
      setError(data.error ?? "Não foi possível criar o fluxo.");
      return;
    }
    router.push(`/dashboard/bot/${data.flow.id}`);
  }

  async function toggle(flow: Flow) {
    const response = await fetch(`/api/bot-flows/${flow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !flow.isActive }),
    });
    if (response.ok) await load();
  }

  async function remove(flow: Flow) {
    if (!confirm(`Excluir o fluxo ${flow.name}?`)) return;
    const response = await fetch(`/api/bot-flows/${flow.id}`, { method: "DELETE" });
    if (response.ok) await load();
    else {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Não foi possível excluir o fluxo.");
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Automação de atendimento</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Fluxos do Bot</h1><p className="mt-1 text-sm text-slate-500">Desenhe menus, mensagens e regras sem escrever código.</p></div>
          <button onClick={() => void create()} disabled={creating} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Novo fluxo</button>
        </header>
        {error && <p className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading ? <div className="grid place-items-center py-24"><LoaderCircle className="size-7 animate-spin text-emerald-600" /></div> : flows.length === 0 ? <div className="mt-7 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center"><Bot className="mb-3 size-10 text-slate-300" /><h2 className="font-bold">Nenhum fluxo criado</h2><p className="mt-1 text-sm text-slate-500">Comece com um fluxo de boas-vindas.</p></div> : <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{flows.map((flow) => <article key={flow.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className={`grid size-11 place-items-center rounded-xl ${flow.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}><Workflow className="size-5" /></span><div className="flex gap-1"><button onClick={() => void toggle(flow)} className={`rounded-lg p-2 ${flow.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`} aria-label={flow.isActive ? "Desativar" : "Ativar"}><CirclePower className="size-4" /></button><button onClick={() => void remove(flow)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Excluir"><Trash2 className="size-4" /></button></div></div><div className="mt-4 flex items-center gap-2"><h2 className="min-w-0 truncate font-bold">{flow.name}</h2>{flow.isDefault && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Star className="size-3 fill-current" />Padrão</span>}</div><p className="mt-1 text-xs text-slate-400">{flow.triggerKeyword ? `Gatilho: “${flow.triggerKeyword}”` : "Inicia por mensagem padrão"}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${flow.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{flow.isActive ? "Ativo" : "Inativo"}</span><span className="ml-2 text-[10px] text-slate-400">{flow._count.conversations} conversa(s)</span></div><Link href={`/dashboard/bot/${flow.id}`} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Pencil className="size-3.5" />Editar</Link></div></article>)}</div>}
      </div>
    </main>
  );
}
