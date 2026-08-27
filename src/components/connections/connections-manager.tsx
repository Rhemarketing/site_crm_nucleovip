"use client";

import {
  AlertCircle,
  Check,
  Clipboard,
  Cloud,
  LoaderCircle,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  phoneNumberId: string;
  wabaId: string;
  businessAccountId: string;
  status: "ACTIVE" | "INACTIVE";
  qualityRating: string | null;
  createdAt: string;
};

function maskId(value: string) {
  return value.length <= 8
    ? value
    : `${value.slice(0, 3)}••••••${value.slice(-5)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={() => void copy()}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      aria-label="Copiar identificador"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Clipboard className="size-3.5" />
      )}
    </button>
  );
}

function QualityBadge({ rating }: { rating: string | null }) {
  const normalized = rating?.toUpperCase() ?? "UNKNOWN";
  const style =
    normalized === "GREEN"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "YELLOW"
        ? "bg-amber-50 text-amber-700"
        : normalized === "RED"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-500";
  const label =
    normalized === "GREEN"
      ? "Qualidade alta"
      : normalized === "YELLOW"
        ? "Qualidade média"
        : normalized === "RED"
          ? "Qualidade baixa"
          : "Qualidade não informada";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        style,
      )}
    >
      <ShieldCheck className="size-3.5" />
      {label}
    </span>
  );
}

function NewConnectionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phoneNumberId: "",
    wabaId: "",
    businessAccountId: "",
    accessToken: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Object.values(form).every((value) => value.trim());

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/whatsapp-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as {
        error?: string;
        meta?: { message?: string; userMessage?: string };
      };
      if (!response.ok)
        throw new Error(
          data.meta?.userMessage ??
            data.meta?.message ??
            data.error ??
            "Não foi possível validar a conexão.",
        );
      onCreated();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar a conexão.",
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Smartphone className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Nova conexão WhatsApp
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Os dados serão validados diretamente na Graph API da Meta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">
              Nome de identificação
            </span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="WhatsApp Principal Vendas"
              className={inputClass}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">
              Phone Number ID
            </span>
            <input
              required
              value={form.phoneNumberId}
              onChange={(event) =>
                setForm({ ...form, phoneNumberId: event.target.value.trim() })
              }
              placeholder="123456789012345"
              className={inputClass}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">
              WABA ID
            </span>
            <input
              required
              value={form.wabaId}
              onChange={(event) =>
                setForm({ ...form, wabaId: event.target.value.trim() })
              }
              placeholder="123456789012345"
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">
              Business Account ID
            </span>
            <input
              required
              value={form.businessAccountId}
              onChange={(event) =>
                setForm({
                  ...form,
                  businessAccountId: event.target.value.trim(),
                })
              }
              placeholder="123456789012345"
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">
              Token de acesso
            </span>
            <textarea
              required
              rows={4}
              value={form.accessToken}
              onChange={(event) =>
                setForm({ ...form, accessToken: event.target.value.trim() })
              }
              placeholder="Cole o token permanente ou temporário da Meta"
              className={cn(inputClass, "resize-none font-mono text-xs")}
            />
            <span className="mt-1.5 block text-[11px] leading-4 text-slate-400">
              O token é armazenado no servidor e nunca aparece na listagem.
            </span>
          </label>
          {error && (
            <div
              role="alert"
              className="sm:col-span-2 flex gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 disabled:bg-slate-300"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Cloud className="size-4" />
            )}
            {saving ? "Validando na Meta..." : "Validar e conectar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteModal({
  account,
  onClose,
  onDeleted,
}: {
  account: Account;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setLoading(true);
    const response = await fetch(`/api/whatsapp-accounts/${account.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Não foi possível excluir.");
      setLoading(false);
      return;
    }
    onDeleted();
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
          <Trash2 className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-bold">Excluir conexão?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          A conexão <strong className="text-slate-700">{account.name}</strong>{" "}
          será removida. Se houver conversas relacionadas, desative-a em vez de
          excluir.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void remove()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading && <LoaderCircle className="size-4 animate-spin" />}Excluir
            conexão
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConnectionsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp-accounts", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        accounts?: Account[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Não foi possível carregar as conexões.");
      setAccounts(data.accounts ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao carregar conexões.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function toggle(account: Account) {
    const nextStatus = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const response = await fetch(`/api/whatsapp-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) await load();
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
              WhatsApp Cloud API
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Conexões WhatsApp
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Conecte os números oficiais da sua empresa e acompanhe a qualidade
              de cada conta.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            Nova conexão
          </button>
        </div>
        {error && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="size-4" />
            </button>
          </div>
        )}
        {loading ? (
          <div className="grid place-items-center py-28">
            <LoaderCircle className="size-7 animate-spin text-emerald-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-8 grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Unplug className="size-8" />
            </span>
            <h2 className="mt-5 text-lg font-bold">
              Nenhum WhatsApp conectado
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Adicione sua primeira conta da Meta para receber mensagens e
              começar os atendimentos.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="size-4" />
              Criar primeira conexão
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between border-b border-slate-100 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl",
                        account.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      <Phone className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-slate-900">
                        {account.name}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        Conta criada em{" "}
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(account.createdAt),
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                      account.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        account.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : "bg-slate-400",
                      )}
                    />
                    {account.status === "ACTIVE" ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Phone Number ID
                    </p>
                    <div className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-600">
                      <span>{maskId(account.phoneNumberId)}</span>
                      <CopyButton value={account.phoneNumberId} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      WABA ID
                    </p>
                    <div className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-600">
                      <span>{maskId(account.wabaId)}</span>
                      <CopyButton value={account.wabaId} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <QualityBadge rating={account.qualityRating} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <button
                    onClick={() => void toggle(account)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white hover:shadow-sm"
                  >
                    <RefreshCw className="size-3.5" />
                    {account.status === "ACTIVE" ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    onClick={() => setDeleting(account)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="size-3.5" />
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {creating && (
        <NewConnectionModal
          onClose={() => setCreating(false)}
          onCreated={() => void load()}
        />
      )}
      {deleting && (
        <DeleteModal
          account={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => void load()}
        />
      )}
    </main>
  );
}
