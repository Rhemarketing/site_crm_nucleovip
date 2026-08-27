import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-full place-items-center bg-slate-50 p-6">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Icon className="size-8" />
        </span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
          Em desenvolvimento
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        <Link
          href="/dashboard/chat"
          className="mt-7 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
        >
          Voltar ao Live Chat
        </Link>
      </div>
    </main>
  );
}
