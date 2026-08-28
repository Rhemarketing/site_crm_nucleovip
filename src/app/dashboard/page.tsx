import {
  ArrowRight,
  CheckCheck,
  Megaphone,
  MessageCircle,
  Smartphone,
  Users,
} from "lucide-react";
import Link from "next/link";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function relativeTime(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(0, minutes)} min atrás`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h atrás`;
  return `${Math.floor(minutes / 1440)} d atrás`;
}

export default async function DashboardPage() {
  const session = await requireCurrentUser();
  const tenantId = session.tenantId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    activeConversations,
    contacts,
    campaignTotals,
    inboundGroups,
    outboundGroups,
    recentConversations,
    recentCampaigns,
  ] = await Promise.all([
    prisma.conversation.count({
      where: { tenantId, status: { in: ["OPEN", "PENDING"] } },
    }),
    prisma.contact.count({ where: { tenantId } }),
    prisma.campaign.aggregate({
      where: { tenantId, createdAt: { gte: monthStart } },
      _sum: { sentCount: true },
    }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { tenantId, direction: "INBOUND", createdAt: { gte: monthStart } },
    }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        tenantId,
        direction: "OUTBOUND",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.conversation.findMany({
      where: { tenantId },
      orderBy: { lastMessageAt: "desc" },
      take: 6,
      include: {
        contact: { select: { name: true, phone: true } },
        assignedUser: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        createdAt: true,
      },
    }),
  ]);
  const outboundIds = new Set(
    outboundGroups.map((item) => item.conversationId),
  );
  const responseRate = inboundGroups.length
    ? Math.round(
        (inboundGroups.filter((item) => outboundIds.has(item.conversationId))
          .length /
          inboundGroups.length) *
          100,
      )
    : 0;
  const cards = [
    {
      label: "Conversas ativas",
      value: activeConversations,
      detail: "Abertas e pendentes",
      icon: MessageCircle,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Contatos",
      value: contacts,
      detail: "Base total do CRM",
      icon: Users,
      color: "bg-sky-50 text-sky-600",
    },
    {
      label: "Mensagens em campanhas",
      value: campaignTotals._sum.sentCount ?? 0,
      detail: "Enviadas neste mês",
      icon: Megaphone,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Taxa de resposta",
      value: `${responseRate}%`,
      detail: "Conversas respondidas no mês",
      icon: CheckCheck,
      color: "bg-amber-50 text-amber-600",
    },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-600">
            Central de operação
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe os principais números e atividades recentes do
            atendimento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/chat"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300"
          >
            <MessageCircle className="size-4 text-emerald-600" />
            Abrir Live Chat
          </Link>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300"
          >
            <Megaphone className="size-4 text-violet-600" />
            Nova campanha
          </Link>
          <Link
            href="/dashboard/connections"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Smartphone className="size-4" />
            Conectar WhatsApp
          </Link>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, color }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div
              className={`grid size-11 place-items-center rounded-xl ${color}`}
            >
              <Icon className="size-5" />
            </div>
            <p className="mt-5 text-3xl font-bold text-slate-900">{value}</p>
            <h2 className="mt-1 text-sm font-semibold">{label}</h2>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-bold">Conversas recentes</h2>
              <p className="text-xs text-slate-500">
                Últimas interações recebidas e enviadas
              </p>
            </div>
            <Link
              href="/dashboard/chat"
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600"
            >
              Ver chat <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/chat?conversationId=${conversation.id}`}
              className="grid gap-2 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 sm:grid-cols-[1fr_150px_90px] sm:items-center"
            >
              <div>
                <p className="font-semibold">{conversation.contact.name}</p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                  {conversation.messages[0]?.content ||
                    conversation.contact.phone}
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {conversation.assignedUser?.name || "Não atribuído"}
              </span>
              <span className="text-right text-xs text-slate-400">
                {relativeTime(conversation.lastMessageAt)}
              </span>
            </Link>
          ))}
          {!recentConversations.length && (
            <p className="p-8 text-center text-sm text-slate-400">
              Nenhuma conversa registrada.
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-bold">Campanhas recentes</h2>
              <p className="text-xs text-slate-500">Desempenho dos disparos</p>
            </div>
            <Link
              href="/dashboard/campaigns"
              className="text-xs font-semibold text-emerald-600"
            >
              Ver todas
            </Link>
          </div>
          {recentCampaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="border-b border-slate-100 p-5 last:border-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">
                  {campaign.name}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                  {campaign.status}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${campaign.totalRecipients ? Math.min(100, (campaign.sentCount / campaign.totalRecipients) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {campaign.sentCount} de {campaign.totalRecipients} enviados
              </p>
            </div>
          ))}
          {!recentCampaigns.length && (
            <p className="p-8 text-center text-sm text-slate-400">
              Nenhuma campanha registrada.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
