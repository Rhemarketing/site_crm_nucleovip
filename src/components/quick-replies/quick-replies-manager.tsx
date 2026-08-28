"use client";

import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Reply = {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  mediaUrl: string | null;
};

export function QuickRepliesManager() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [editing, setEditing] = useState<Reply | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const data = await fetch("/api/quick-replies").then((r) => r.json());
    setReplies(data.replies ?? []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function show(reply?: Reply) {
    setEditing(reply ?? null);
    setError("");
    setOpen(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(
      editing ? `/api/quick-replies/${editing.id}` : "/api/quick-replies",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    setOpen(false);
    await load();
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta resposta rápida?")) return;
    await fetch(`/api/quick-replies/${id}`, { method: "DELETE" });
    await load();
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Respostas rápidas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie textos reutilizáveis. No chat, digite / para localizar um
            atalho.
          </p>
        </div>
        <button
          onClick={() => show()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="size-4" />
          Nova resposta
        </button>
      </header>
      {replies.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {replies.map((reply) => (
            <article
              key={reply.id}
              className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-sm font-bold text-emerald-700">
                    /{reply.shortcut}
                  </span>
                  <h2 className="mt-3 font-semibold">{reply.title}</h2>
                </div>
                <div className="flex">
                  <button
                    onClick={() => show(reply)}
                    className="p-2 text-slate-400 hover:text-emerald-600"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => void remove(reply.id)}
                    className="p-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {reply.content}
              </p>
              {reply.mediaUrl && (
                <p className="mt-auto truncate pt-4 text-xs text-sky-600">
                  Mídia: {reply.mediaUrl}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
          <div>
            <MessageSquareText className="mx-auto mb-4 size-12 text-slate-300" />
            <p className="font-semibold">Nenhuma resposta rápida</p>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre a primeira para agilizar o atendimento.
            </p>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"
          >
            <h2 className="text-lg font-bold">
              {editing ? "Editar resposta" : "Nova resposta rápida"}
            </h2>
            {error && (
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            )}
            <label className="block text-sm font-semibold">
              Atalho
              <div className="mt-2 flex rounded-xl border focus-within:border-emerald-500">
                <span className="px-3 py-3 text-slate-400">/</span>
                <input
                  name="shortcut"
                  required
                  defaultValue={editing?.shortcut}
                  placeholder="boasvindas"
                  className="min-w-0 flex-1 rounded-r-xl outline-none"
                />
              </div>
            </label>
            <label className="block text-sm font-semibold">
              Título
              <input
                name="title"
                required
                defaultValue={editing?.title}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Conteúdo
              <textarea
                name="content"
                rows={6}
                required
                defaultValue={editing?.content}
                className="mt-2 w-full resize-none rounded-xl border p-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              URL de mídia (opcional)
              <input
                name="mediaUrl"
                type="url"
                defaultValue={editing?.mediaUrl ?? ""}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
