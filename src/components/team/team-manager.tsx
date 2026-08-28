"use client";

import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  isActive: boolean;
  createdAt: string;
  _count?: { assignedConversations: number };
};

export function TeamManager({
  currentUserId,
  canEdit,
}: {
  currentUserId: string;
  canEdit: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState("");
  async function load() {
    const data = await fetch("/api/team").then((r) => r.json());
    setMembers(data.users ?? []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    setTemporary(data.temporaryPassword || "Senha definida no formulário.");
    setOpen(false);
    await load();
  }
  async function update(id: string, patch: Partial<Member>) {
    const response = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    await load();
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie administradores e atendentes da organização.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <UserPlus className="size-4" />
            Novo usuário
          </button>
        )}
      </header>
      {(error || temporary) && (
        <div
          className={`rounded-xl border p-4 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error || (
            <>
              Usuário criado. Senha temporária: <strong>{temporary}</strong>
            </>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1fr_160px_120px_110px_110px] border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-400 md:grid">
          <span>Usuário</span>
          <span>Perfil</span>
          <span>Atendimentos</span>
          <span>Cadastro</span>
          <span>Status</span>
        </div>
        {members.map((member) => (
          <div
            key={member.id}
            className="grid gap-3 border-b border-slate-100 p-5 last:border-0 md:grid-cols-[1fr_160px_120px_110px_110px] md:items-center"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                {member.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold">
                  {member.name}
                  {member.id === currentUserId && (
                    <span className="ml-2 text-xs text-slate-400">Você</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
            </div>
            <div>
              {canEdit ? (
                <select
                  value={member.role}
                  onChange={(e) =>
                    void update(member.id, {
                      role: e.target.value as Member["role"],
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="AGENT">Atendente</option>
                </select>
              ) : (
                <span className="text-sm">
                  {member.role === "ADMIN" ? "Administrador" : "Atendente"}
                </span>
              )}
            </div>
            <span className="text-sm text-slate-600">
              {member._count?.assignedConversations ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              {new Intl.DateTimeFormat("pt-BR").format(
                new Date(member.createdAt),
              )}
            </span>
            <button
              disabled={!canEdit || member.id === currentUserId}
              onClick={() =>
                void update(member.id, { isActive: !member.isActive })
              }
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {member.isActive ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
      </div>
      {members.length === 0 && (
        <div className="grid place-items-center py-16 text-slate-400">
          <Users className="mb-3 size-10" />
          Nenhum usuário encontrado.
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            onSubmit={(e) => void create(e)}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-emerald-600" />
              <h2 className="text-lg font-bold">Adicionar à equipe</h2>
            </div>
            <input
              name="name"
              required
              placeholder="Nome completo"
              className="w-full rounded-xl border p-3"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="E-mail"
              className="w-full rounded-xl border p-3"
            />
            <select name="role" className="w-full rounded-xl border p-3">
              <option value="AGENT">Atendente</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <input
              name="password"
              type="password"
              placeholder="Senha (vazio para gerar automaticamente)"
              className="w-full rounded-xl border p-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Criar usuário
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
