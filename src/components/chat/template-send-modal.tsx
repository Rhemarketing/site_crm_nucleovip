"use client";

import { LayoutTemplate, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ChatConversationDto, ChatMessageDto } from "@/types/chat";

type ChatTemplate = {
  id: string;
  name: string;
  language: string;
  components: Array<{ type?: string; text?: string }>;
};

export function TemplateSendModal({
  conversation,
  onClose,
  onSent,
}: {
  conversation: ChatConversationDto;
  onClose: () => void;
  onSent: (message: ChatMessageDto) => void;
}) {
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = templates.find((template) => template.id === selectedId);
  const variableIds = useMemo(() => {
    const found = new Set<string>();
    selected?.components.forEach((component) => {
      for (const match of component.text?.matchAll(/\{\{(\d+)\}\}/g) ?? [])
        found.add(match[1]);
    });
    return [...found].sort((a, b) => Number(a) - Number(b));
  }, [selected]);
  const preview = selected?.components
    .find((component) => component.type === "BODY")
    ?.text?.replace(
      /\{\{(\d+)\}\}/g,
      (_, index: string) => variables[index] || `{{${index}}}`,
    );

  useEffect(() => {
    fetch(
      `/api/templates?whatsappAccountId=${conversation.whatsappAccount.id}&status=APPROVED`,
      { cache: "no-store" },
    )
      .then(
        (response) => response.json() as Promise<{ templates: ChatTemplate[] }>,
      )
      .then((data) => {
        setTemplates(data.templates);
        setSelectedId(data.templates[0]?.id ?? "");
      })
      .catch(() => setError("Não foi possível carregar os templates."))
      .finally(() => setLoading(false));
  }, [conversation.whatsappAccount.id]);

  async function send() {
    if (!selectedId || variableIds.some((id) => !variables[id]?.trim())) return;
    setSending(true);
    setError(null);
    const response = await fetch("/api/chat/messages/send-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversation.id,
        templateId: selectedId,
        variables,
      }),
    });
    const data = (await response.json()) as {
      message?: ChatMessageDto;
      error?: string;
    };
    setSending(false);
    if (!response.ok || !data.message) {
      setError(data.error ?? "Falha ao enviar template.");
      return;
    }
    onSent(data.message);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Enviar template</h2>
            <p className="text-xs text-slate-500">
              Reabra a conversa com uma mensagem aprovada.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        {loading ? (
          <div className="grid place-items-center py-20">
            <LoaderCircle className="size-6 animate-spin text-emerald-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <LayoutTemplate className="mx-auto mb-3 size-9 text-slate-300" />
            <p className="font-bold">Nenhum template aprovado</p>
            <p className="mt-1 text-sm text-slate-500">
              Sincronize os templates desta conta primeiro.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold">Template aprovado</label>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setVariables({});
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.language}
                  </option>
                ))}
              </select>
              <div className="mt-4 space-y-3">
                {variableIds.map((id) => (
                  <label key={id} className="block">
                    <span className="text-xs font-semibold">
                      Variável {`{{${id}}}`}
                    </span>
                    <input
                      value={variables[id] ?? ""}
                      onChange={(event) =>
                        setVariables({ ...variables, [id]: event.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="chat-pattern rounded-2xl border border-slate-200 p-4">
              <div className="rounded-xl rounded-bl-sm bg-white p-3 text-sm shadow-sm">
                <p className="whitespace-pre-wrap text-slate-700">{preview}</p>
                <p className="mt-2 text-right text-[10px] text-slate-400">
                  agora
                </p>
              </div>
            </div>
            {error && (
              <p className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void send()}
            disabled={
              !selectedId ||
              sending ||
              variableIds.some((id) => !variables[id]?.trim())
            }
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
          >
            {sending && <LoaderCircle className="size-4 animate-spin" />}Enviar
            template
          </button>
        </div>
      </div>
    </div>
  );
}
