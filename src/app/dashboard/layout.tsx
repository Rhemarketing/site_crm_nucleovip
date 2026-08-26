import { ContactRound, LayoutTemplate, MessageCircleMore } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard/chat", label: "Atendimento", icon: MessageCircleMore },
  { href: "/dashboard/contacts", label: "Contatos", icon: ContactRound },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <Link href="/dashboard/chat" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white"><MessageCircleMore className="size-5" /></span>
          <span className="hidden font-bold tracking-tight sm:block">WhatsApp CRM</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm sm:text-sm">
              <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <span className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">AD</span>
      </header>
      {children}
    </div>
  );
}
