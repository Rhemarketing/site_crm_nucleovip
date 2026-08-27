"use client";

import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    organizationName: "",
    document: "",
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const document = form.document.replace(/\D/g, "");
    if (document.length !== 14) {
      setError("Informe um CNPJ válido com 14 números.");
      return;
    }
    if (form.password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          document,
          email: form.email.trim().toLowerCase(),
        }),
      });
      const registerData = (await registerResponse.json()) as {
        error?: string;
      };
      if (!registerResponse.ok)
        throw new Error(
          registerData.error ?? "Não foi possível criar a conta.",
        );
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          tenantDocument: document,
        }),
      });
      const loginData = (await loginResponse.json()) as { error?: string };
      if (!loginResponse.ok)
        throw new Error(
          loginData.error ?? "Conta criada. Faça login para continuar.",
        );
      router.replace("/dashboard/chat");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Nome da empresa
          </span>
          <span className={fieldClass}>
            <Building2 className="size-4 text-slate-400" />
            <input
              required
              value={form.organizationName}
              onChange={(event) =>
                setForm({ ...form, organizationName: event.target.value })
              }
              placeholder="Empresa Exemplo Ltda."
              className="min-w-0 flex-1 text-sm outline-none"
            />
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            CNPJ
          </span>
          <span className={fieldClass}>
            <Building2 className="size-4 text-slate-400" />
            <input
              required
              inputMode="numeric"
              value={form.document}
              onChange={(event) =>
                setForm({ ...form, document: event.target.value })
              }
              placeholder="00.000.000/0001-00"
              className="min-w-0 flex-1 text-sm outline-none"
            />
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Nome do administrador
          </span>
          <span className={fieldClass}>
            <UserRound className="size-4 text-slate-400" />
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Seu nome completo"
              className="min-w-0 flex-1 text-sm outline-none"
            />
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            E-mail
          </span>
          <span className={fieldClass}>
            <Mail className="size-4 text-slate-400" />
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="voce@empresa.com.br"
              className="min-w-0 flex-1 text-sm outline-none"
            />
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Senha
          </span>
          <span className={fieldClass}>
            <LockKeyhole className="size-4 text-slate-400" />
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Mínimo de 8 caracteres"
              className="min-w-0 flex-1 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="text-slate-400"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </span>
        </label>
      </div>
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 transition hover:bg-emerald-700 disabled:bg-slate-300"
      >
        {loading && <LoaderCircle className="size-4 animate-spin" />}
        {loading ? "Criando sua conta..." : "Criar conta e acessar"}
      </button>
      <p className="pt-2 text-center text-sm text-slate-500">
        Já possui uma conta?{" "}
        <Link href="/login" className="font-bold text-emerald-700">
          Entrar
        </Link>
      </p>
    </form>
  );
}
