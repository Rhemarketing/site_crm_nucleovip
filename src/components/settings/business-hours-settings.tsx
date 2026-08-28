"use client";

import { Clock3, Save } from "lucide-react";
import { useEffect, useState } from "react";

import type { BusinessHours } from "@/lib/business-hours";

const days = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type Settings = {
  businessHours: BusinessHours;
  timezone: string;
  outOfOfficeEnabled: boolean;
  outOfOfficeMessage: string | null;
};

export function BusinessHoursSettings({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/settings/business-hours")
      .then((response) => response.json())
      .then((data) => setSettings(data.settings));
  }, []);

  function updateDay(day: number, patch: Partial<BusinessHours[string]>) {
    if (!settings) return;
    setSettings({
      ...settings,
      businessHours: {
        ...settings.businessHours,
        [day]: { ...settings.businessHours[day], ...patch },
      },
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/settings/business-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    setNotice(
      response.ok
        ? "Configurações salvas com sucesso."
        : data.error || "Não foi possível salvar.",
    );
    setSaving(false);
  }

  if (!settings)
    return (
      <div className="p-8 text-sm text-slate-500">
        Carregando configurações...
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Horário de atendimento
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina quando sua equipe está disponível e a resposta automática fora
          do expediente.
        </p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <Clock3 className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Expediente semanal</h2>
            <p className="text-xs text-slate-500">
              Fuso horário usado para verificar cada mensagem recebida.
            </p>
          </div>
        </div>
        <div className="space-y-1 p-4">
          {days.map((label, day) => {
            const item = settings.businessHours[String(day)];
            return (
              <div
                key={label}
                className="grid items-center gap-3 rounded-xl p-3 hover:bg-slate-50 sm:grid-cols-[180px_1fr]"
              >
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateDay(day, { enabled: e.target.checked })
                    }
                    className="size-4 accent-emerald-600"
                  />
                  {label}
                </label>
                {item.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={item.open}
                      disabled={!canEdit}
                      onChange={(e) => updateDay(day, { open: e.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <span className="text-xs text-slate-400">até</span>
                    <input
                      type="time"
                      value={item.close}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateDay(day, { close: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold">
          Fuso horário
          <input
            value={settings.timezone}
            disabled={!canEdit}
            onChange={(e) =>
              setSettings({ ...settings, timezone: e.target.value })
            }
            className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500"
          />
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.outOfOfficeEnabled}
            disabled={!canEdit}
            onChange={(e) =>
              setSettings({ ...settings, outOfOfficeEnabled: e.target.checked })
            }
            className="mt-1 size-4 accent-emerald-600"
          />
          <span>
            <strong className="block text-sm">
              Ativar resposta automática fora do expediente
            </strong>
            <span className="text-xs text-slate-500">
              Enviada no máximo uma vez a cada 24 horas por conversa.
            </span>
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Mensagem de ausência
          <textarea
            rows={4}
            value={settings.outOfOfficeMessage ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setSettings({ ...settings, outOfOfficeMessage: e.target.value })
            }
            placeholder="Olá! Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento."
            className="mt-2 block w-full resize-none rounded-xl border border-slate-200 p-4 font-normal outline-none focus:border-emerald-500"
          />
        </label>
      </section>
      <div className="flex items-center justify-end gap-4">
        {notice && <p className="text-sm text-slate-600">{notice}</p>}
        {canEdit && (
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="size-4" />
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        )}
      </div>
    </div>
  );
}
