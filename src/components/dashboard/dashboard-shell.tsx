"use client";

import {
  Bot,
  FileText,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  tenant: { id: string; name: string; document: string | null };
};

const navigation = [
  { href: "/dashboard/chat", label: "Live Chat", icon: MessageSquare },
  {
    href: "/dashboard/connections",
    label: "Conexões WhatsApp",
    icon: Smartphone,
  },
  { href: "/dashboard/contacts", label: "Contatos", icon: Users },
  { href: "/dashboard/templates", label: "Templates", icon: FileText },
  {
    href: "/dashboard/campaigns",
    label: "Disparos em Massa",
    icon: Send,
    soon: true,
  },
  { href: "/dashboard/bot", label: "Automações / Bot", icon: Bot, soon: true },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-800 bg-[#091711] text-white transition-[width] duration-200",
      "w-[272px]",
      collapsed ? "lg:w-[78px]" : "lg:w-[272px]",
      )}
    >
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <Link
          href="/dashboard/chat"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-3"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-[#062117] shadow-lg shadow-emerald-500/20">
            <MessageSquare className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <strong className="block truncate text-sm">Núcleo CRM</strong>
              <span className="block truncate text-[11px] text-emerald-100/45">
                WhatsApp Cloud
              </span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white lg:block"
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <div className="px-3 py-4">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto hidden rounded-lg p-2.5 text-white/50 hover:bg-white/10 hover:text-white lg:block"
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="size-5" />
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-emerald-100/85">
              {user.tenant.name}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/35">
              {user.tenant.document
                ? `CNPJ ${user.tenant.document}`
                : `ID ${user.tenant.id.slice(0, 12)}`}
            </p>
          </div>
        )}
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {navigation.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                active
                  ? "bg-emerald-500 text-[#062117] shadow-lg shadow-emerald-950/20"
                  : "text-white/55 hover:bg-white/[0.07] hover:text-white",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {soon && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        active
                          ? "bg-emerald-950/15"
                          : "bg-white/10 text-white/35",
                      )}
                    >
                      Em breve
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl p-2",
            collapsed && "justify-center",
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">
            {initials(user.name)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user.name}</p>
              <p className="truncate text-[10px] text-white/35">{user.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => void logout()}
              disabled={loggingOut}
              className="rounded-lg p-2 text-white/40 hover:bg-rose-500/10 hover:text-rose-300"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => void logout()}
            disabled={loggingOut}
            className="mt-2 grid w-full place-items-center rounded-lg p-2 text-white/40 hover:bg-rose-500/10 hover:text-rose-300"
            aria-label="Sair"
          >
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <div className="hidden h-full lg:block">{sidebar}</div>
      {mobileOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            {sidebar}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 rounded-lg p-2 text-white/50"
            >
              <X className="size-5" />
            </button>
          </div>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => {
              setCollapsed(false);
              setMobileOpen(true);
            }}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white">
              <MessageSquare className="size-4" />
            </span>
            <span className="text-sm font-bold">Núcleo CRM</span>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
            {initials(user.name)}
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
