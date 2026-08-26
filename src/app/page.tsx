import { Database, MessageCircle, Waypoints } from "lucide-react";

const foundations = [
  { label: "PostgreSQL + Prisma", icon: Database },
  { label: "WhatsApp Cloud API", icon: MessageCircle },
  { label: "BullMQ + Redis", icon: Waypoints },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <span className="mb-5 w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
        Fase 1 · Fundação
      </span>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        WhatsApp CRM multi-tenant pronto para evoluir.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-emerald-50/65">
        App Router, infraestrutura local e isolamento relacional por tenant configurados.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {foundations.map(({ label, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <Icon className="mb-4 size-6 text-emerald-400" aria-hidden="true" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
