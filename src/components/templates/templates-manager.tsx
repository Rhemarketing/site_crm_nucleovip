"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImageIcon,
  LayoutTemplate,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Account = { id: string; name: string; phoneNumberId: string };
type Component = {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
};
type Template = {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: Component[];
  whatsappAccount: Account | null;
};

const statusStyle = {
  APPROVED: {
    label: "Aprovado",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700",
  },
  REJECTED: {
    label: "Rejeitado",
    icon: AlertCircle,
    className: "bg-rose-50 text-rose-700",
  },
};

function TemplatePreview({ components }: { components: Component[] }) {
  const header = components.find((item) => item.type === "HEADER");
  const body = components.find((item) => item.type === "BODY");
  const footer = components.find((item) => item.type === "FOOTER");
  const buttons =
    components.find((item) => item.type === "BUTTONS")?.buttons ?? [];
  const highlight = (text = "") =>
    text.split(/(\{\{\d+\}\})/g).map((part, index) =>
      /^\{\{\d+\}\}$/.test(part) ? (
        <mark
          key={`${part}-${index}`}
          className="rounded bg-amber-100 px-1 text-amber-800"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  return (
    <div className="chat-pattern rounded-2xl border border-slate-200 p-4">
      <div className="max-w-[290px] rounded-xl rounded-bl-sm bg-white p-3 text-sm shadow-sm">
        {header?.text && (
          <p className="mb-2 font-bold">{highlight(header.text)}</p>
        )}
        {header && header.format && header.format !== "TEXT" && (
          <div className="mb-3 grid h-28 place-items-center rounded-lg bg-slate-100 text-slate-400">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-1 size-7" />
              <span className="text-[10px] font-bold uppercase">
                Cabeçalho {header.format.toLowerCase()}
              </span>
            </div>
          </div>
        )}
        <p className="whitespace-pre-wrap text-slate-700">
          {highlight(body?.text ?? "Corpo do template")}
        </p>
        {footer?.text && (
          <p className="mt-2 text-[11px] text-slate-400">{footer.text}</p>
        )}
        <p className="mt-2 text-right text-[10px] text-slate-400">10:42</p>
        {buttons.map((button) => (
          <div
            key={button.text}
            className="mt-2 border-t border-slate-100 pt-2 text-center text-xs font-semibold text-sky-600"
          >
            {button.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateTemplateModal({
  accountId,
  onClose,
  onCreated,
}: {
  accountId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    language: "pt_BR",
    category: "UTILITY" as Template["category"],
    header: "",
    body: "Olá {{1}}, temos uma atualização para você.",
    footer: "",
    buttonText: "",
    buttonType: "QUICK_REPLY" as "QUICK_REPLY" | "URL" | "PHONE_NUMBER",
    buttonValue: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const components: Component[] = [
    ...(form.header
      ? [{ type: "HEADER", format: "TEXT", text: form.header }]
      : []),
    { type: "BODY", text: form.body },
    ...(form.footer ? [{ type: "FOOTER", text: form.footer }] : []),
    ...(form.buttonText
      ? [
          {
            type: "BUTTONS",
            buttons: [
              {
                type: form.buttonType,
                text: form.buttonText,
                ...(form.buttonType === "URL" ? { url: form.buttonValue } : {}),
                ...(form.buttonType === "PHONE_NUMBER"
                  ? { phone_number: form.buttonValue }
                  : {}),
              },
            ],
          },
        ]
      : []),
  ];
  async function create() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappAccountId: accountId,
        name: form.name,
        language: form.language,
        category: form.category,
        components,
      }),
    });
    const data = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Falha ao enviar para a Meta.");
      return;
    }
    onCreated();
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Novo template</h2>
            <p className="text-xs text-slate-500">
              Submeta a mensagem para análise da Meta.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-7 p-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold">Nome</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="confirmacao_pedido"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold">Idioma</span>
              <select
                value={form.language}
                onChange={(event) =>
                  setForm({ ...form, language: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="pt_BR">Português (Brasil)</option>
                <option value="en_US">English (US)</option>
                <option value="es">Español</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold">
                Categoria
              </span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value as Template["category"],
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold">
                Cabeçalho de texto (opcional)
              </span>
              <input
                value={form.header}
                onChange={(event) =>
                  setForm({ ...form, header: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 flex items-center justify-between text-xs font-semibold">
                Corpo
                <button
                  type="button"
                  onClick={() => {
                    const indexes = [...form.body.matchAll(/\{\{(\d+)\}\}/g)].map(
                      (match) => Number(match[1]),
                    );
                    const next = Math.max(0, ...indexes) + 1;
                    setForm({ ...form, body: `${form.body} {{${next}}}` });
                  }}
                  className="text-emerald-700 hover:text-emerald-800"
                >
                  + Inserir variável
                </button>
              </span>
              <textarea
                rows={6}
                value={form.body}
                onChange={(event) =>
                  setForm({ ...form, body: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Use {"{{1}}"}, {"{{2}}"} para variáveis dinâmicas.
              </p>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold">Rodapé</span>
              <input
                value={form.footer}
                onChange={(event) =>
                  setForm({ ...form, footer: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold">
                Tipo do botão
              </span>
              <select
                value={form.buttonType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    buttonType: event.target.value as typeof form.buttonType,
                    buttonValue: "",
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="QUICK_REPLY">Resposta rápida</option>
                <option value="URL">Abrir endereço (URL)</option>
                <option value="PHONE_NUMBER">Ligar para telefone</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold">
                Texto do botão
              </span>
              <input
                value={form.buttonText}
                onChange={(event) =>
                  setForm({ ...form, buttonText: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            {form.buttonType !== "QUICK_REPLY" && (
              <label>
                <span className="mb-1 block text-xs font-semibold">
                  {form.buttonType === "URL" ? "Endereço (URL)" : "Telefone"}
                </span>
                <input
                  value={form.buttonValue}
                  onChange={(event) =>
                    setForm({ ...form, buttonValue: event.target.value })
                  }
                  placeholder={
                    form.buttonType === "URL"
                      ? "https://exemplo.com/pedido/{{1}}"
                      : "+5511999999999"
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            )}
            {error && (
              <p className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Pré-visualização
            </p>
            <TemplatePreview components={components} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void create()}
            disabled={saving || !form.name || !form.body}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
          >
            {saving && <LoaderCircle className="size-4 animate-spin" />}Enviar
            para aprovação
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (accountId) params.set("whatsappAccountId", accountId);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    const response = await fetch(`/api/templates?${params}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      templates: Template[];
      accounts: Account[];
    };
    setTemplates(data.templates);
    setAccounts(data.accounts);
    setAccountId((current) => current || data.accounts[0]?.id || "");
    setLoading(false);
  }, [accountId, category, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function sync() {
    if (!accountId) return;
    setSyncing(true);
    setMessage(null);
    const response = await fetch("/api/templates/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappAccountId: accountId }),
    });
    const data = (await response.json()) as { synced?: number; error?: string };
    setSyncing(false);
    setMessage(
      response.ok
        ? `${data.synced} templates sincronizados.`
        : (data.error ?? "Falha na sincronização."),
    );
    if (response.ok) await load();
  }
  async function remove(template: Template) {
    if (!confirm(`Excluir ${template.name} da Meta?`)) return;
    const response = await fetch(`/api/templates/${template.id}`, {
      method: "DELETE",
    });
    if (response.ok) await load();
    else {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Falha ao excluir.");
    }
  }
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
              Meta Cloud API
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Templates
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Crie, sincronize e acompanhe a aprovação das mensagens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="min-w-56 appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-semibold"
              >
                <option value="">Selecione uma conta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
            </div>
            <button
              onClick={() => void sync()}
              disabled={!accountId || syncing}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-50"
            >
              {syncing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sincronizar com a Meta
            </button>
            <button
              onClick={() => setCreating(true)}
              disabled={!accountId}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
            >
              <Plus className="size-4" />
              Novo template
            </button>
          </div>
        </div>
        {message && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span>{message}</span>
            <button onClick={() => setMessage(null)}>
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="APPROVED">Aprovados</option>
            <option value="PENDING">Pendentes</option>
            <option value="REJECTED">Rejeitados</option>
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas as categorias</option>
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
        {loading ? (
          <div className="grid place-items-center py-24">
            <LoaderCircle className="size-7 animate-spin text-emerald-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="mt-7 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center">
            <LayoutTemplate className="mb-3 size-10 text-slate-300" />
            <h2 className="font-bold">Nenhum template encontrado</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sincronize uma conta ou crie o primeiro template.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {templates.map((template) => {
              const config = statusStyle[template.status];
              const StatusIcon = config.icon;
              return (
                <article
                  key={template.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="size-4 text-emerald-600" />
                        <h2 className="truncate font-bold">{template.name}</h2>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {template.language} · {template.whatsappAccount?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => void remove(template)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 px-5 pt-4">
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        config.className,
                      )}
                    >
                      <StatusIcon className="size-3.5" />
                      {config.label}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      <ShieldCheck className="size-3.5" />
                      {template.category}
                    </span>
                  </div>
                  <div className="p-5">
                    <TemplatePreview components={template.components} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {creating && (
        <CreateTemplateModal
          accountId={accountId}
          onClose={() => setCreating(false)}
          onCreated={() => void load()}
        />
      )}
    </main>
  );
}
