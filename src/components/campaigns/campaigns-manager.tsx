"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  Eye,
  FileText,
  LoaderCircle,
  MessageCircleCheck,
  Plus,
  Radio,
  Search,
  Send,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type CampaignStatus =
  | "DRAFT"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type Account = { id: string; name: string; phoneNumberId: string };
type Tag = { id: string; name: string; color: string };
type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; text?: string }>;
};
type Template = {
  id: string;
  whatsappAccountId: string | null;
  name: string;
  language: string;
  category: string;
  components: TemplateComponent[];
};
type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  percentage: number;
  scheduledAt: string | null;
  createdAt: string;
  whatsappAccount: Account;
  template: Template;
};
type Metrics = {
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  averageReadRate: number;
};
type CampaignsResponse = {
  campaigns: Campaign[];
  pagination: { page: number; total: number; totalPages: number };
  metrics: Metrics;
  creationData: { accounts: Account[]; templates: Template[]; tags: Tag[] };
};
type VariableMapping = {
  type: "field" | "fixed";
  field?: "firstName" | "name" | "phone" | "email";
  value?: string;
};

const statusConfig: Record<
  CampaignStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: { label: "Rascunho", className: "bg-slate-100 text-slate-600", icon: FileText },
  QUEUED: { label: "Agendada", className: "bg-sky-50 text-sky-700", icon: CalendarClock },
  PROCESSING: { label: "Em envio", className: "bg-amber-50 text-amber-700", icon: Radio },
  COMPLETED: { label: "Concluída", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  FAILED: { label: "Falhou", className: "bg-rose-50 text-rose-700", icon: AlertTriangle },
  CANCELLED: { label: "Cancelada", className: "bg-slate-100 text-slate-600", icon: CircleX },
};

function getVariables(components: TemplateComponent[]) {
  const variables = new Set<string>();
  for (const component of components) {
    for (const match of component.text?.matchAll(/\{\{(\d+)\}\}/g) ?? []) {
      variables.add(match[1]);
    }
  }
  return [...variables].sort((a, b) => Number(a) - Number(b));
}

function defaultMappings(components: TemplateComponent[]) {
  return Object.fromEntries(
    getVariables(components).map((variable) => [
      variable,
      { type: "field", field: "name" } satisfies VariableMapping,
    ]),
  );
}

function TemplatePreview({ template }: { template: Template }) {
  const header = template.components.find((component) => component.type === "HEADER");
  const body = template.components.find((component) => component.type === "BODY");
  const footer = template.components.find((component) => component.type === "FOOTER");
  const buttons = template.components.find((component) => component.type === "BUTTONS")?.buttons ?? [];
  const highlight = (text = "") =>
    text.split(/(\{\{\d+\}\})/g).map((part, index) =>
      /^\{\{\d+\}\}$/.test(part) ? (
        <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-1 text-amber-800">
          {part}
        </mark>
      ) : (
        part
      ),
    );

  return (
    <div className="chat-pattern rounded-2xl border border-slate-200 p-4">
      <div className="rounded-xl rounded-bl-sm bg-white p-3 text-sm shadow-sm">
        {header?.text && <p className="mb-2 font-bold">{highlight(header.text)}</p>}
        {header?.format && header.format !== "TEXT" && (
          <div className="mb-2 grid h-24 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
            MÍDIA {header.format}
          </div>
        )}
        <p className="whitespace-pre-wrap text-slate-700">
          {highlight(body?.text ?? "Corpo do template")}
        </p>
        {footer?.text && <p className="mt-2 text-[11px] text-slate-400">{footer.text}</p>}
        {buttons.map((button) => (
          <p key={`${button.type}-${button.text}`} className="mt-2 border-t border-slate-100 pt-2 text-center text-xs font-semibold text-sky-600">
            {button.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function CampaignWizard({
  accounts,
  templates,
  tags,
  onClose,
  onCreated,
}: {
  accounts: Account[];
  templates: Template[];
  tags: Tag[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const initialAccountId = accounts[0]?.id ?? "";
  const initialTemplate = templates.find(
    (item) => item.whatsappAccountId === initialAccountId,
  );
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(initialAccountId);
  const availableTemplates = templates.filter(
    (template) => template.whatsappAccountId === accountId,
  );
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const template = availableTemplates.find((item) => item.id === templateId);
  const variables = template ? getVariables(template.components) : [];
  const [mappings, setMappings] = useState<Record<string, VariableMapping>>(
    initialTemplate ? defaultMappings(initialTemplate.components) : {},
  );
  const [audience, setAudience] = useState<"all" | "tags">("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: "1" });
      if (audience === "tags" && tagIds.length) params.set("tagIds", tagIds.join(","));
      fetch(`/api/contacts?${params}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ pagination: { total: number } }>)
        .then((data) => setAudienceCount(data.pagination.total))
        .catch(() => setAudienceCount(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [audience, tagIds]);

  function canContinue() {
    if (step === 1) return name.trim().length >= 3 && Boolean(accountId);
    if (step === 2) {
      return Boolean(templateId) && variables.every((variable) => {
        const mapping = mappings[variable];
        return mapping?.type === "field" || Boolean(mapping?.value?.trim());
      });
    }
    if (step === 3) return audience === "all" || tagIds.length > 0;
    return sendMode === "now" || Boolean(scheduledAt);
  }

  async function submit() {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          whatsappAccountId: accountId,
          templateId,
          tagIds: audience === "tags" ? tagIds : [],
          variableMappings: mappings,
          scheduledAt:
            sendMode === "schedule" && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar a campanha.");
      onCreated();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a campanha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Passo {step} de 4</p>
            <h2 className="text-xl font-bold">Nova campanha</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </header>
        <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50 px-4 sm:px-8">
          {["Configuração", "Template", "Público", "Agendamento"].map((label, index) => (
            <div key={label} className={cn("border-b-2 px-1 py-3 text-center text-[10px] font-bold sm:text-xs", step === index + 1 ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-400")}>
              {label}
            </div>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
          {step === 1 && (
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <h3 className="text-lg font-bold">Informações básicas</h3>
                <p className="text-sm text-slate-500">Dê um nome claro e escolha o número remetente.</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Nome da campanha</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Lembrete de renovação — Setembro" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Conta WhatsApp</span>
                <select value={accountId} onChange={(event) => {
                  const nextAccountId = event.target.value;
                  const nextTemplate = templates.find(
                    (item) => item.whatsappAccountId === nextAccountId,
                  );
                  setAccountId(nextAccountId);
                  setTemplateId(nextTemplate?.id ?? "");
                  setMappings(
                    nextTemplate ? defaultMappings(nextTemplate.components) : {},
                  );
                }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="">Selecione uma conta</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold">Template aprovado</h3>
                  <p className="text-sm text-slate-500">Escolha a mensagem e defina o conteúdo de cada variável.</p>
                </div>
                <select value={templateId} onChange={(event) => {
                  const nextId = event.target.value;
                  const nextTemplate = availableTemplates.find((item) => item.id === nextId);
                  setTemplateId(nextId);
                  setMappings(nextTemplate ? defaultMappings(nextTemplate.components) : {});
                }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="">Selecione um template</option>
                  {availableTemplates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}
                </select>
                {variables.map((variable) => {
                  const mapping = mappings[variable] ?? { type: "field", field: "name" };
                  return (
                    <div key={variable} className="rounded-xl border border-slate-200 p-4">
                      <p className="mb-3 text-xs font-bold text-slate-700">Variável {`{{${variable}}}`}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select value={mapping.type === "fixed" ? "fixed" : mapping.field} onChange={(event) => {
                          const value = event.target.value;
                          setMappings({ ...mappings, [variable]: value === "fixed" ? { type: "fixed", value: "" } : { type: "field", field: value as VariableMapping["field"] } });
                        }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                          <option value="firstName">Primeiro nome</option>
                          <option value="name">Nome completo</option>
                          <option value="phone">Telefone</option>
                          <option value="email">E-mail</option>
                          <option value="fixed">Texto fixo</option>
                        </select>
                        {mapping.type === "fixed" && (
                          <input value={mapping.value ?? ""} onChange={(event) => setMappings({ ...mappings, [variable]: { type: "fixed", value: event.target.value } })} placeholder="Digite o texto" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                        )}
                      </div>
                    </div>
                  );
                })}
                {availableTemplates.length === 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Esta conta não possui templates aprovados. Sincronize-os na página de Templates.</p>}
              </div>
              <div>{template && <TemplatePreview template={template} />}</div>
            </div>
          )}
          {step === 3 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold">Público-alvo</h3>
                <p className="text-sm text-slate-500">Envie para toda a base ou crie um segmento por etiquetas.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => { setAudience("all"); setTagIds([]); }} className={cn("rounded-2xl border p-5 text-left", audience === "all" ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}>
                  <Users className="mb-3 size-6 text-emerald-600" /><strong className="block text-sm">Todos os contatos</strong><span className="text-xs text-slate-500">Toda a base válida do tenant</span>
                </button>
                <button onClick={() => setAudience("tags")} className={cn("rounded-2xl border p-5 text-left", audience === "tags" ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}>
                  <Tags className="mb-3 size-6 text-emerald-600" /><strong className="block text-sm">Filtrar por etiquetas</strong><span className="text-xs text-slate-500">Contatos de segmentos selecionados</span>
                </button>
              </div>
              {audience === "tags" && (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 p-4">
                  {tags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return <button key={tag.id} onClick={() => setTagIds(active ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", active ? "border-transparent text-white" : "border-slate-200 text-slate-500")} style={active ? { backgroundColor: tag.color } : undefined}>{tag.name}</button>;
                  })}
                </div>
              )}
              <div className="flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white">
                <Users className="size-7 text-emerald-400" />
                <div><strong className="block text-2xl">{audienceCount ?? "—"}</strong><span className="text-xs text-slate-300">contatos estimados para receber</span></div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold">Envio e agendamento</h3>
                <p className="text-sm text-slate-500">Revise os dados e escolha quando iniciar.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => setSendMode("now")} className={cn("rounded-2xl border p-5 text-left", sendMode === "now" ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}><Send className="mb-3 size-6 text-emerald-600" /><strong className="block text-sm">Disparar imediatamente</strong><span className="text-xs text-slate-500">Entrar na fila assim que confirmar</span></button>
                <button onClick={() => setSendMode("schedule")} className={cn("rounded-2xl border p-5 text-left", sendMode === "schedule" ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}><CalendarClock className="mb-3 size-6 text-emerald-600" /><strong className="block text-sm">Agendar data e horário</strong><span className="text-xs text-slate-500">Processar automaticamente no horário</span></button>
              </div>
              {sendMode === "schedule" && <input type="datetime-local" value={scheduledAt} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                <h4 className="mb-3 font-bold">Resumo</h4>
                <dl className="grid gap-2 text-slate-600 sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Campanha</dt><dd className="font-semibold text-slate-800">{name}</dd></div><div><dt className="text-xs text-slate-400">Template</dt><dd className="font-semibold text-slate-800">{template?.name}</dd></div><div><dt className="text-xs text-slate-400">Público estimado</dt><dd className="font-semibold text-slate-800">{audienceCount ?? "—"} contatos</dd></div><div><dt className="text-xs text-slate-400">Início</dt><dd className="font-semibold text-slate-800">{sendMode === "now" ? "Imediato" : scheduledAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(scheduledAt)) : "Não definido"}</dd></div></dl>
              </div>
              {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 sm:px-7">
          <button onClick={() => step === 1 ? onClose() : setStep(step - 1)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"><ChevronLeft className="size-4" />{step === 1 ? "Cancelar" : "Voltar"}</button>
          {step < 4 ? <button onClick={() => setStep(step + 1)} disabled={!canContinue()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:bg-slate-300">Continuar<ChevronRight className="size-4" /></button> : <button onClick={() => void submit()} disabled={!canContinue() || saving} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:bg-slate-300">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Confirmar campanha</button>}
        </footer>
      </div>
    </div>
  );
}

export function CampaignsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalRecipients: 0, sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0, averageReadRate: 0 });
  const [creationData, setCreationData] = useState<CampaignsResponse["creationData"]>({ accounts: [], templates: [], tags: [] });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const response = await fetch(`/api/campaigns?${params}`, { cache: "no-store" });
    const data = (await response.json()) as CampaignsResponse & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as campanhas.");
    setCampaigns(data.campaigns);
    setMetrics(data.metrics);
    setCreationData(data.creationData);
    setPagination(data.pagination);
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load().catch((error: Error) => setMessage(error.message)), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const stream = new EventSource("/api/chat/stream");
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; data?: Partial<Campaign> & { campaignId?: string } };
        if (payload.type !== "CAMPAIGN_PROGRESS" || !payload.data?.campaignId) return;
        setCampaigns((current) => current.map((campaign) => campaign.id === payload.data?.campaignId ? { ...campaign, ...payload.data } : campaign));
      } catch {
        // Eventos de outras áreas podem ser ignorados nesta tela.
      }
    };
    return () => stream.close();
  }, []);

  async function cancel(campaign: Campaign) {
    if (!confirm(`Cancelar a campanha ${campaign.name}?`)) return;
    const response = await fetch(`/api/campaigns/${campaign.id}/cancel`, { method: "POST" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setMessage(data.error ?? "Não foi possível cancelar."); return; }
    await load();
  }

  const metricCards = [
    { label: "Total de disparos", value: metrics.totalRecipients, icon: Send, color: "text-sky-600 bg-sky-50" },
    { label: "Mensagens entregues", value: metrics.deliveredCount, icon: MessageCircleCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Taxa média de leitura", value: `${metrics.averageReadRate}%`, icon: Eye, color: "text-violet-600 bg-violet-50" },
    { label: "Falhas", value: metrics.failedCount, icon: AlertTriangle, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Comunicação em escala</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Campanhas</h1><p className="mt-1 text-sm text-slate-500">Dispare templates aprovados com segmentação e ritmo seguro.</p></div>
          <button onClick={() => setCreating(true)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Plus className="size-4" />Nova campanha</button>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={cn("mb-4 grid size-10 place-items-center rounded-xl", card.color)}><card.icon className="size-5" /></div><strong className="text-2xl">{card.value}</strong><p className="mt-1 text-xs font-semibold text-slate-500">{card.label}</p></article>)}
        </div>
        {message && <div className="mt-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{message}</span><button onClick={() => setMessage(null)}><X className="size-4" /></button></div>}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><Search className="size-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar campanha" className="w-full bg-transparent text-sm outline-none" /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todos os status</option><option value="QUEUED">Agendadas</option><option value="PROCESSING">Em envio</option><option value="COMPLETED">Concluídas</option><option value="CANCELLED">Canceladas</option><option value="FAILED">Falhas</option></select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Campanha</th><th className="px-5 py-3">Conta / Template</th><th className="px-5 py-3">Data</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Progresso</th><th className="px-5 py-3">Resultados</th><th className="px-5 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={7} className="py-20 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-emerald-600" /></td></tr> : campaigns.length === 0 ? <tr><td colSpan={7} className="py-20 text-center"><Send className="mx-auto mb-3 size-9 text-slate-300" /><p className="font-bold">Nenhuma campanha encontrada</p><p className="mt-1 text-sm text-slate-500">Crie seu primeiro disparo segmentado.</p></td></tr> : campaigns.map((campaign) => {
                  const config = statusConfig[campaign.status]; const StatusIcon = config.icon;
                  return <tr key={campaign.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="max-w-52 truncate text-sm font-bold">{campaign.name}</p><p className="mt-1 text-xs text-slate-400">Criada em {new Intl.DateTimeFormat("pt-BR").format(new Date(campaign.createdAt))}</p></td><td className="px-5 py-4"><p className="text-sm font-semibold">{campaign.whatsappAccount.name}</p><p className="text-xs text-slate-400">{campaign.template.name} · {campaign.template.language}</p></td><td className="px-5 py-4 text-xs text-slate-500">{campaign.scheduledAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(campaign.scheduledAt)) : "Imediato"}</td><td className="px-5 py-4"><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", config.className)}><StatusIcon className={cn("size-3.5", campaign.status === "PROCESSING" && "animate-pulse")} />{config.label}</span></td><td className="px-5 py-4"><div className="flex min-w-40 items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${campaign.percentage}%` }} /></div><span className="w-9 text-right text-xs font-bold">{campaign.percentage}%</span></div><p className="mt-1 text-[10px] text-slate-400">{campaign.sentCount + campaign.failedCount} de {campaign.totalRecipients}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1"><span className="rounded bg-sky-50 px-1.5 py-1 text-[10px] font-bold text-sky-700">{campaign.sentCount} enviados</span><span className="rounded bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700">{campaign.deliveredCount} entregues</span><span className="rounded bg-violet-50 px-1.5 py-1 text-[10px] font-bold text-violet-700">{campaign.readCount} lidos</span><span className="rounded bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-700">{campaign.failedCount} falhas</span></div></td><td className="px-5 py-4 text-right">{["QUEUED", "PROCESSING"].includes(campaign.status) && <button onClick={() => void cancel(campaign)} className="rounded-lg border border-rose-100 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">Cancelar</button>}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs text-slate-500"><span>{pagination.total} campanhas</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="size-4" /></button><span>Página {page} de {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div>}
        </section>
      </div>
      {creating && <CampaignWizard accounts={creationData.accounts} templates={creationData.templates} tags={creationData.tags} onClose={() => setCreating(false)} onCreated={() => void load()} />}
    </main>
  );
}
