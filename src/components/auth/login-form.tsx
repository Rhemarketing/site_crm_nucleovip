"use client";

import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    tenantDocument: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          tenantDocument: form.tenantDocument.replace(/\D/g, "") || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "Não foi possível entrar.");
      const requested = new URLSearchParams(window.location.search).get("next");
      router.replace(
        requested?.startsWith("/dashboard") ? requested : "/dashboard/chat",
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          E-mail
        </span>
        <span className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <Mail className="size-4 text-slate-400" />
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            placeholder="voce@empresa.com.br"
            className="min-w-0 flex-1 text-sm outline-none"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          Senha
        </span>
        <span className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <LockKeyhole className="size-4 text-slate-400" />
          <input
            required
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            placeholder="Sua senha"
            className="min-w-0 flex-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="text-slate-400 hover:text-slate-700"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700">
          <span>Documento/CNPJ</span>
          <span className="text-[11px] font-normal text-slate-400">
            Opcional
          </span>
        </span>
        <span className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <Building2 className="size-4 text-slate-400" />
          <input
            inputMode="numeric"
            value={form.tenantDocument}
            onChange={(event) =>
              setForm({ ...form, tenantDocument: event.target.value })
            }
            placeholder="Somente números"
            className="min-w-0 flex-1 text-sm outline-none"
          />
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-400">
          Necessário apenas se seu e-mail estiver em mais de uma empresa.
        </span>
      </label>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      <button
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading && <LoaderCircle className="size-4 animate-spin" />}
        {loading ? "Entrando..." : "Entrar no painel"}
      </button>
      <p className="pt-2 text-center text-sm text-slate-500">
        Ainda não possui uma conta?{" "}
        <Link
          href="/register"
          className="font-bold text-emerald-700 hover:text-emerald-800"
        >
          Criar gratuitamente
        </Link>
      </p>
    </form>
  );
}
