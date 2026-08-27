"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  CircleUserRound,
  Clock3,
  FileText,
  Headphones,
  ImageIcon,
  Info,
  LoaderCircle,
  LayoutTemplate,
  MessageCircleMore,
  MoreHorizontal,
  Paperclip,
  Phone,
  Search,
  Send,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChatStream } from "@/hooks/use-chat-stream";
import { TemplateSendModal } from "@/components/chat/template-send-modal";
import { cn } from "@/lib/utils";
import type {
  ChatConversationDto,
  ChatConversationStatus,
  ChatEvent,
  ChatMessageDto,
} from "@/types/chat";

type AccountOption = { id: string; name: string; phoneNumberId: string };
type UserOption = { id: string; name: string; email: string };
type TagOption = { id: string; name: string; color: string };
type ConversationsResponse = {
  conversations: ChatConversationDto[];
  filters: {
    accounts: AccountOption[];
    users: UserOption[];
    tags: TagOption[];
  };
};

const statusTabs: Array<{ value: ChatConversationStatus; label: string }> = [
  { value: "OPEN", label: "Abertas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "CLOSED", label: "Finalizadas" },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatTime(date: string) {
  const value = new Date(date);
  const now = new Date();
  return value.toDateString() === now.toDateString()
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }).format(value);
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
}

function windowLabel(conversation: ChatConversationDto) {
  if (!conversation.is24hWindowActive || !conversation.windowExpiresAt)
    return "Janela encerrada";
  const remaining =
    new Date(conversation.windowExpiresAt).getTime() - Date.now();
  if (remaining <= 0) return "Janela encerrada";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}min restantes`;
}

function StatusIcon({ message }: { message: ChatMessageDto }) {
  if (message.status === "FAILED")
    return <AlertTriangle className="size-3.5 text-rose-500" />;
  if (message.status === "SENT")
    return <Check className="size-3.5 text-slate-400" />;
  return (
    <CheckCheck
      className={cn(
        "size-3.5",
        message.status === "READ" ? "text-sky-500" : "text-slate-400",
      )}
    />
  );
}

function MediaContent({ message }: { message: ChatMessageDto }) {
  if (message.type === "TEXT")
    return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
  const Icon =
    message.type === "IMAGE"
      ? ImageIcon
      : message.type === "AUDIO"
        ? Headphones
        : FileText;
  return (
    <div className="flex min-w-52 items-center gap-3 rounded-xl bg-black/5 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/70">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{message.content}</p>
        <p className="text-xs opacity-60">{message.type.toLowerCase()}</p>
      </div>
    </div>
  );
}

export function LiveChat() {
  const [conversations, setConversations] = useState<ChatConversationDto[]>([]);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatConversationStatus>("OPEN");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [filters, setFilters] = useState<ConversationsResponse["filters"]>({
    accounts: [],
    users: [],
    tags: [],
  });
  const [draft, setDraft] = useState("");
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [mediaType, setMediaType] = useState<"IMAGE" | "AUDIO" | "DOCUMENT">(
    "IMAGE",
  );
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams({ status, pageSize: "50" });
    if (search) params.set("search", search);
    if (accountId) params.set("accountId", accountId);
    const response = await fetch(`/api/chat/conversations?${params}`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("Nao foi possivel carregar as conversas.");
    const data = (await response.json()) as ConversationsResponse;
    setConversations(data.conversations);
    setFilters(data.filters);
    const requestedConversationId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("conversationId")
        : null;
    setSelectedId((current) =>
      requestedConversationId &&
      data.conversations.some(
        (conversation) => conversation.id === requestedConversationId,
      )
        ? requestedConversationId
        : current &&
            data.conversations.some(
              (conversation) => conversation.id === current,
            )
          ? current
          : (data.conversations[0]?.id ?? null),
    );
  }, [accountId, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      loadConversations()
        .catch((reason: unknown) =>
          setError(
            reason instanceof Error ? reason.message : "Erro inesperado.",
          ),
        )
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/chat/conversations/${selectedId}/messages?pageSize=100`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Historico indisponivel.");
        return response.json() as Promise<{ messages: ChatMessageDto[] }>;
      })
      .then((data) => setMessages(data.messages))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Erro inesperado."),
      );
    void fetch(`/api/chat/conversations/${selectedId}/read`, {
      method: "POST",
    });
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleRealtimeEvent = useCallback(
    (event: ChatEvent) => {
      if (
        event.type === "NEW_MESSAGE" &&
        event.data.conversationId === selectedId
      ) {
        setMessages((current) =>
          current.some((item) => item.id === event.data.message.id)
            ? current
            : [...current, event.data.message],
        );
        if (event.data.message.direction === "INBOUND") {
          void fetch(
            `/api/chat/conversations/${event.data.conversationId}/read`,
            { method: "POST" },
          );
        }
      }
      if (event.type === "MESSAGE_STATUS_UPDATED") {
        setMessages((current) =>
          current.map((item) =>
            item.id === event.data.messageId
              ? { ...item, status: event.data.status }
              : item,
          ),
        );
      }
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void loadConversations(), 120);
    },
    [loadConversations, selectedId],
  );

  const { connected } = useChatStream(handleRealtimeEvent);

  async function sendMessage() {
    if (!selected || sending || (!draft.trim() && !mediaUrl.trim())) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          type: mediaUrl.trim() ? mediaType : "TEXT",
          content: draft.trim(),
          ...(mediaUrl.trim() ? { mediaUrl: mediaUrl.trim() } : {}),
        }),
      });
      const data = (await response.json()) as {
        message?: ChatMessageDto;
        error?: string;
      };
      if (!response.ok || !data.message)
        throw new Error(data.error ?? "Falha no envio.");
      setMessages((current) =>
        current.some((item) => item.id === data.message!.id)
          ? current
          : [...current, data.message!],
      );
      setDraft("");
      setMediaUrl("");
      setAttachmentOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no envio.");
    } finally {
      setSending(false);
    }
  }

  async function updateConversation(update: {
    status?: ChatConversationStatus;
    assignedUserId?: string | null;
  }) {
    if (!selected) return;
    const response = await fetch(
      `/api/chat/conversations/${selected.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      },
    );
    if (!response.ok) {
      setError("Nao foi possivel atualizar o atendimento.");
      return;
    }
    await loadConversations();
  }

  async function toggleTag(tag: TagOption) {
    if (!selected) return;
    const active = selected.contact.tags.some((item) => item.id === tag.id);
    await fetch(`/api/chat/contacts/${selected.contact.id}/tags`, {
      method: active ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id, conversationId: selected.id }),
    });
    await loadConversations();
  }

  const groupedMessages = useMemo(() => messages, [messages]);

  return (
    <main className="h-full overflow-hidden bg-[#eef2f1] text-slate-900">
      <div
        className={cn(
          "grid h-full grid-cols-1 bg-white lg:grid-cols-[340px_minmax(420px,1fr)]",
          detailsOpen && "xl:grid-cols-[340px_minmax(420px,1fr)_310px]",
        )}
      >
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r border-slate-200 bg-white",
            mobileChatOpen && "hidden lg:flex",
          )}
        >
          <div className="border-b border-slate-200 px-5 pb-4 pt-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                  Atendimento
                </p>
                <h1 className="text-xl font-bold tracking-tight">Conversas</h1>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    connected ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                {connected ? "Ao vivo" : "Reconectando"}
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <Search className="size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome ou telefone"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="relative mt-3">
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Todas as contas WhatsApp</option>
                {filters.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
            </div>
          </div>
          <div className="grid grid-cols-3 border-b border-slate-200 px-3 pt-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "border-b-2 px-1 py-3 text-xs font-semibold transition",
                  status === tab.value
                    ? "border-emerald-500 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center py-16">
                <LoaderCircle className="size-6 animate-spin text-emerald-600" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <MessageCircleMore className="mx-auto mb-3 size-8 text-slate-300" />
                <p className="text-sm font-semibold">Nenhuma conversa aqui</p>
                <p className="mt-1 text-xs text-slate-500">
                  Novas mensagens aparecerão em tempo real.
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setMobileChatOpen(true);
                  }}
                  className={cn(
                    "group flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50",
                    selectedId === conversation.id &&
                      "bg-emerald-50/70 hover:bg-emerald-50",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 text-sm font-bold text-emerald-800">
                    {initials(conversation.contact.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">
                        {conversation.contact.name}
                      </strong>
                      <time className="shrink-0 text-[11px] text-slate-400">
                        {formatTime(conversation.lastMessageAt)}
                      </time>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-500">
                        {conversation.lastMessage?.content ??
                          "Conversa iniciada"}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-medium text-slate-500">
                      <Phone className="size-3" />
                      <span className="truncate">
                        {conversation.whatsappAccount.name}
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section
          className={cn(
            "relative flex min-h-0 flex-col bg-[#f5f7f6]",
            !mobileChatOpen && "hidden lg:flex",
          )}
        >
          {selected ? (
            <>
              <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setMobileChatOpen(false)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                    {initials(selected.contact.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold sm:text-base">
                      {selected.contact.name}
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                      {formatPhone(selected.contact.phone)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex",
                      selected.is24hWindowActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    <Clock3 className="size-3.5" />
                    {windowLabel(selected)}
                  </span>
                  <button
                    onClick={() => setTemplateOpen(true)}
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                  >
                    <LayoutTemplate className="size-4" />
                    <span className="hidden sm:inline">Template</span>
                  </button>
                  <button
                    onClick={() =>
                      void updateConversation({ status: "CLOSED" })
                    }
                    className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 md:flex"
                  >
                    <Archive className="size-4" />
                    Finalizar
                  </button>
                  <button
                    onClick={() => setDetailsOpen((open) => !open)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Detalhes"
                  >
                    <Info className="size-5" />
                  </button>
                  <button
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
              </header>
              {!selected.is24hWindowActive && (
                <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
                  <AlertTriangle className="size-4" />A janela de 24h encerrou.
                  Use um template aprovado para retomar.
                </div>
              )}
              <div className="chat-pattern min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <div className="mx-auto flex max-w-3xl flex-col gap-2">
                  {groupedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "OUTBOUND"
                          ? "justify-end"
                          : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[68%]",
                          message.direction === "OUTBOUND"
                            ? "rounded-br-md bg-[#d9fdd3]"
                            : "rounded-bl-md bg-white",
                        )}
                      >
                        <MediaContent message={message} />
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                          <time>{formatTime(message.createdAt)}</time>
                          {message.direction === "OUTBOUND" && (
                            <StatusIcon message={message} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              {error && (
                <div className="flex items-center justify-between bg-rose-50 px-5 py-2 text-xs font-medium text-rose-700">
                  <span>{error}</span>
                  <button onClick={() => setError(null)}>
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
                {attachmentOpen && selected.is24hWindowActive && (
                  <div className="mx-auto mb-2 flex max-w-3xl flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row">
                    <select
                      value={mediaType}
                      onChange={(event) =>
                        setMediaType(event.target.value as typeof mediaType)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="IMAGE">Imagem</option>
                      <option value="AUDIO">Áudio</option>
                      <option value="DOCUMENT">Documento</option>
                    </select>
                    <input
                      value={mediaUrl}
                      onChange={(event) => setMediaUrl(event.target.value)}
                      placeholder="URL pública da mídia"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => {
                        setAttachmentOpen(false);
                        setMediaUrl("");
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
                      aria-label="Cancelar anexo"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                <div
                  className={cn(
                    "mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm",
                    selected.is24hWindowActive
                      ? "border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"
                      : "border-amber-200 bg-amber-50/40",
                  )}
                >
                  <button
                    onClick={() => setAttachmentOpen((open) => !open)}
                    disabled={!selected.is24hWindowActive}
                    className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Anexar"
                  >
                    <Paperclip className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={draft}
                      onChange={(event) =>
                        setDraft(event.target.value.slice(0, 4096))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      disabled={!selected.is24hWindowActive}
                      rows={1}
                      placeholder={
                        mediaUrl
                          ? "Adicione uma legenda (opcional)"
                          : selected.is24hWindowActive
                            ? "Digite uma mensagem..."
                            : "Janela encerrada — envie um template"
                      }
                      className="max-h-32 min-h-10 w-full resize-none bg-transparent px-1 py-2 text-sm outline-none disabled:cursor-not-allowed"
                    />
                    <p className="pr-1 text-right text-[10px] text-slate-400">
                      {draft.length}/4096
                    </p>
                  </div>
                  <button
                    onClick={() => void sendMessage()}
                    disabled={
                      !selected.is24hWindowActive ||
                      (!draft.trim() && !mediaUrl.trim()) ||
                      sending
                    }
                    className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    aria-label="Enviar"
                  >
                    {sending ? (
                      <LoaderCircle className="size-5 animate-spin" />
                    ) : (
                      <Send className="size-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100">
                  <MessageCircleMore className="size-8 text-emerald-700" />
                </span>
                <h2 className="mt-4 font-bold">Selecione uma conversa</h2>
                <p className="mt-1 text-sm text-slate-500">
                  O atendimento aparecerá aqui.
                </p>
              </div>
            </div>
          )}
        </section>

        {selected && detailsOpen && (
          <aside className="absolute inset-y-0 right-0 z-20 w-[310px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl xl:static xl:z-auto xl:shadow-none">
            <div className="flex h-[76px] items-center justify-between border-b border-slate-200 px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Contexto
                </p>
                <h3 className="font-bold">Contato e atendimento</h3>
              </div>
              <button
                onClick={() => setDetailsOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 xl:hidden"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="border-b border-slate-100 px-5 py-6 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 text-lg font-bold text-emerald-800">
                {initials(selected.contact.name)}
              </span>
              <h4 className="mt-3 font-bold">{selected.contact.name}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {formatPhone(selected.contact.phone)}
              </p>
            </div>
            <div className="space-y-6 p-5">
              <div>
                <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  <CircleUserRound className="size-4" />
                  Dados do contato
                </h5>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">E-mail</dt>
                    <dd className="mt-0.5 font-medium">
                      {selected.contact.email ?? "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Cliente desde</dt>
                    <dd className="mt-0.5 font-medium">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(selected.contact.createdAt))}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  <Tag className="size-4" />
                  Etiquetas
                </h5>
                <div className="flex flex-wrap gap-2">
                  {filters.tags.length ? (
                    filters.tags.map((tag) => {
                      const active = selected.contact.tags.some(
                        (item) => item.id === tag.id,
                      );
                      return (
                        <button
                          key={tag.id}
                          onClick={() => void toggleTag(tag)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            active
                              ? "border-transparent text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400",
                          )}
                          style={
                            active ? { backgroundColor: tag.color } : undefined
                          }
                        >
                          {active && <Check className="mr-1 inline size-3" />}
                          {tag.name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400">
                      Nenhuma etiqueta cadastrada.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  <UsersRound className="size-4" />
                  Responsável
                </h5>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                  <select
                    value={selected.assignedUser?.id ?? ""}
                    onChange={(event) =>
                      void updateConversation({
                        assignedUserId: event.target.value || null,
                      })
                    }
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">Não atribuído</option>
                    {filters.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
                </div>
              </div>
              <div>
                <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  <Clock3 className="size-4" />
                  Histórico
                </h5>
                <div className="space-y-3">
                  {selected.assignmentHistory.length ? (
                    selected.assignmentHistory.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="relative border-l-2 border-emerald-100 pl-3 text-xs"
                      >
                        <p className="font-semibold text-slate-700">
                          {assignment.assignedUser?.name ??
                            "Atendimento sem responsável"}
                        </p>
                        <p className="mt-0.5 text-slate-400">
                          por {assignment.assignedByUser.name} ·{" "}
                          {formatTime(assignment.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      Nenhuma transferência registrada.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
        {selected && templateOpen && (
          <TemplateSendModal
            conversation={selected}
            onClose={() => setTemplateOpen(false)}
            onSent={(message) =>
              setMessages((current) =>
                current.some((item) => item.id === message.id)
                  ? current
                  : [...current, message],
              )
            }
          />
        )}
      </div>
    </main>
  );
}
