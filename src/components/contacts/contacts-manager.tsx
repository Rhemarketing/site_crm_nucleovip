"use client";

import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  MessageCircleMore,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; color: string; contactCount: number };
type Account = { id: string; name: string; phoneNumberId: string };
type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  tags: Tag[];
  conversationCount: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ContactModal({
  contact,
  tags,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    customFields: contact?.customFields
      ? JSON.stringify(contact.customFields, null, 2)
      : "{}",
    tagIds: contact?.tags.map((tag) => tag.id) ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      let customFields: Record<string, unknown> = {};
      try {
        customFields = JSON.parse(form.customFields) as Record<string, unknown>;
      } catch {
        throw new Error("Campos personalizados devem ser um JSON válido.");
      }
      const response = await fetch(
        contact ? `/api/contacts/${contact.id}` : "/api/contacts",
        {
          method: contact ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, customFields }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao salvar.");
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">
              {contact ? "Editar contato" : "Novo contato"}
            </h2>
            <p className="text-xs text-slate-500">
              Dados usados em conversas e segmentações.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Nome completo
            </span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              WhatsApp
            </span>
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
              placeholder="5511999999999"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              E-mail
            </span>
            <input
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <div className="sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold text-slate-600">
              Etiquetas
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = form.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        tagIds: active
                          ? form.tagIds.filter((id) => id !== tag.id)
                          : [...form.tagIds, tag.id],
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      active
                        ? "border-transparent text-white"
                        : "border-slate-200 text-slate-500",
                    )}
                    style={active ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Campos personalizados (JSON)
            </span>
            <textarea
              rows={4}
              value={form.customFields}
              onChange={(event) =>
                setForm({ ...form, customFields: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-emerald-500"
            />
          </label>
          {error && (
            <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving && <LoaderCircle className="size-4 animate-spin" />}Salvar
            contato
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  tags,
  onClose,
  onImported,
}: {
  tags: Tag[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<{
    totalProcessed: number;
    created: number;
    updated: number;
    duplicated: number;
    errorCount: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function upload() {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    tagIds.forEach((id) => form.append("tagIds", id));
    try {
      const data = await new Promise<{ report?: typeof report; error?: string }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/contacts/import");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 85));
            }
          };
          xhr.onload = () => {
            try {
              const payload = JSON.parse(xhr.responseText) as {
                report?: typeof report;
                error?: string;
              };
              if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(payload.error ?? "Falha na importação."));
                return;
              }
              resolve(payload);
            } catch {
              reject(new Error("Resposta inválida durante a importação."));
            }
          };
          xhr.onerror = () =>
            reject(new Error("Falha de conexão durante a importação."));
          xhr.send(form);
        },
      );
      setProgress(100);
      if (!data.report) throw new Error(data.error ?? "Falha na importação.");
      setReport(data.report);
      onImported();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha na importação.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Importar contatos</h2>
            <p className="text-xs text-slate-500">
              CSV ou Excel com colunas nome, telefone e e-mail.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          {!report ? (
            <>
              <label
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const dropped = event.dataTransfer.files[0];
                  if (dropped && /\.(csv|xlsx)$/i.test(dropped.name)) {
                    setFile(dropped);
                    setError(null);
                  } else {
                    setError("Selecione um arquivo CSV ou XLSX.");
                  }
                }}
                className={cn(
                  "grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed bg-slate-50 px-6 py-10 text-center transition hover:border-emerald-400",
                  dragging
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200",
                )}
              >
                <FileSpreadsheet className="mb-3 size-9 text-emerald-600" />
                <strong className="text-sm">
                  {file?.name ?? "Selecione CSV ou XLSX"}
                </strong>
                <span className="mt-1 text-xs text-slate-400">Até 10 MB</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {loading && (
                <div aria-label={`Importação ${progress}%`}>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                    <span>Enviando e processando</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  Aplicar etiquetas em todos
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() =>
                          setTagIds(
                            active
                              ? tagIds.filter((id) => id !== tag.id)
                              : [...tagIds, tag.id],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          active
                            ? "border-transparent text-white"
                            : "border-slate-200 text-slate-500",
                        )}
                        style={
                          active ? { backgroundColor: tag.color } : undefined
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}
              <button
                onClick={() => void upload()}
                disabled={!file || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Processar planilha
              </button>
            </>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ["Processadas", report.totalProcessed],
                  ["Criados", report.created],
                  ["Atualizados", report.updated],
                  ["Erros", report.errorCount],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-slate-50 p-3 text-center"
                  >
                    <strong className="block text-xl">{value}</strong>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
              {report.errors.length > 0 && (
                <div className="mt-4 max-h-40 overflow-auto rounded-xl border border-rose-100 bg-rose-50 p-3">
                  {report.errors.map((item) => (
                    <p
                      key={`${item.row}-${item.error}`}
                      className="text-xs text-rose-700"
                    >
                      Linha {item.row}: {item.error}
                    </p>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagsManager({
  tags,
  onClose,
  onChanged,
}: {
  tags: Tag[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10B981");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setColor("#10B981");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        editingId ? `/api/tags/${editingId}` : "/api/tags",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar a etiqueta.");
      }
      reset();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a etiqueta.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(tag: Tag) {
    if (!confirm(`Excluir a etiqueta ${tag.name}? Ela será removida dos contatos.`)) {
      return;
    }
    const response = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Não foi possível excluir a etiqueta.");
      return;
    }
    if (editingId === tag.id) reset();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Gerenciar etiquetas</h2>
            <p className="text-xs text-slate-500">
              Crie segmentos visuais para sua base.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="border-b border-slate-200 p-6">
          <div className="flex gap-3">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="h-11 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              aria-label="Cor da etiqueta"
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Cliente VIP"
              maxLength={50}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => void save()}
              disabled={saving || !name.trim()}
              className="rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:bg-slate-300"
            >
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : editingId ? (
                "Salvar"
              ) : (
                "Criar"
              )}
            </button>
          </div>
          {editingId && (
            <button
              onClick={reset}
              className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancelar edição
            </button>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{tag.name}</p>
                <p className="text-xs text-slate-400">
                  {tag.contactCount} contato(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingId(tag.id);
                  setName(tag.name);
                  setColor(tag.color);
                  setError(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={`Editar ${tag.name}`}
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => void remove(tag)}
                className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                aria-label={`Excluir ${tag.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">
              Nenhuma etiqueta criada.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export function ContactsManager() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [chatAccountId, setChatAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (search) params.set("search", search);
    if (selectedTags.length) params.set("tagIds", selectedTags.join(","));
    const [contactsResponse, tagsResponse, accountsResponse] =
      await Promise.all([
        fetch(`/api/contacts?${params}`, { cache: "no-store" }),
        fetch("/api/tags", { cache: "no-store" }),
        fetch("/api/whatsapp-accounts", { cache: "no-store" }),
      ]);
    const contactsData = (await contactsResponse.json()) as {
      contacts: Contact[];
    };
    const tagsData = (await tagsResponse.json()) as { tags: Tag[] };
    const accountsData = (await accountsResponse.json()) as {
      accounts: Account[];
    };
    setContacts(contactsData.contacts);
    setTags(tagsData.tags);
    setAccounts(accountsData.accounts);
    setChatAccountId(
      (current) => current || accountsData.accounts[0]?.id || "",
    );
    setLoading(false);
  }, [search, selectedTags]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  async function remove(contact: Contact) {
    if (!confirm(`Excluir ${contact.name}?`)) return;
    const response = await fetch(`/api/contacts/${contact.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      alert(data.error ?? "Não foi possível excluir.");
      return;
    }
    await load();
  }
  async function startChat(contact: Contact) {
    if (!chatAccountId) {
      alert("Cadastre uma conta WhatsApp antes de iniciar o atendimento.");
      return;
    }
    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: contact.id,
        whatsappAccountId: chatAccountId,
      }),
    });
    const data = (await response.json()) as {
      conversation?: { id: string };
      error?: string;
    };
    if (!response.ok || !data.conversation) {
      alert(data.error ?? "Não foi possível iniciar a conversa.");
      return;
    }
    router.push(`/dashboard/chat?conversationId=${data.conversation.id}`);
  }
  const exportUrl = `/api/contacts/export?search=${encodeURIComponent(search)}&tagIds=${selectedTags.join(",")}`;
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
              Relacionamento
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Contatos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Organize sua base e crie segmentos por etiquetas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setManagingTags(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <Tags className="size-4" />
              Etiquetas
            </button>
            <a
              href={exportUrl}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <Download className="size-4" />
              Exportar CSV
            </a>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <Upload className="size-4" />
              Importar
            </button>
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              Novo contato
            </button>
          </div>
        </div>
        <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome, telefone ou e-mail"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={chatAccountId}
              onChange={(event) => setChatAccountId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold"
              aria-label="Conta usada para iniciar conversas"
            >
              <option value="">Conta para iniciar chat</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() =>
                      setSelectedTags(
                        active
                          ? selectedTags.filter((id) => id !== tag.id)
                          : [...selectedTags, tag.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      active
                        ? "border-transparent text-white"
                        : "border-slate-200 text-slate-500",
                    )}
                    style={active ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.name}{" "}
                    <span className="opacity-70">{tag.contactCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Contato</th>
                  <th className="px-5 py-3 font-semibold">Telefone</th>
                  <th className="px-5 py-3 font-semibold">Etiquetas</th>
                  <th className="px-5 py-3 font-semibold">Conversas</th>
                  <th className="px-5 py-3 font-semibold">Cadastro</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-emerald-600" />
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <UserRoundPlus className="mx-auto mb-3 size-8 text-slate-300" />
                      <p className="text-sm font-semibold">
                        Nenhum contato encontrado
                      </p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                            {initials(contact.name)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">
                              {contact.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {contact.email ?? "Sem e-mail"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        +{contact.phone}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {contact.conversationCount}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(contact.createdAt),
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditing(contact)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => void remove(contact)}
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                          <button
                            onClick={() => void startChat(contact)}
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                            aria-label="Iniciar conversa"
                          >
                            <MessageCircleMore className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editing && (
        <ContactModal
          contact={editing === "new" ? null : editing}
          tags={tags}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
      {importing && (
        <ImportModal
          tags={tags}
          onClose={() => setImporting(false)}
          onImported={() => void load()}
        />
      )}
      {managingTags && (
        <TagsManager
          tags={tags}
          onClose={() => setManagingTags(false)}
          onChanged={() => void load()}
        />
      )}
    </main>
  );
}
