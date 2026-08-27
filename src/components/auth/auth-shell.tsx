import {
  CheckCircle2,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
      <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <MessageCircleMore className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            Núcleo CRM
          </span>
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            WhatsApp Cloud API
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-slate-400">
          Atendimento seguro e centralizado para sua equipe.
        </p>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#071b15] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 size-96 rounded-full bg-teal-400/10 blur-3xl" />
        <span className="relative flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
          <Sparkles className="size-3.5" />
          CRM feito para conversas que vendem
        </span>
        <div className="relative max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Transforme cada conversa em uma oportunidade.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/60">
            Atenda em equipe, organize contatos e acompanhe todas as mensagens
            da sua operação em um só lugar.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              "Atendimento em tempo real",
              "Isolamento por empresa",
              "Templates oficiais da Meta",
              "Contatos segmentados",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2.5 text-sm text-emerald-50/80"
              >
                <CheckCircle2 className="size-4 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-emerald-50/40">
          <ShieldCheck className="size-4" />
          Dados protegidos por organização
        </div>
      </aside>
    </main>
  );
}
