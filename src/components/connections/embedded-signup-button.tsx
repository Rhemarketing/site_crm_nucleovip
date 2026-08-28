"use client";

import { Cloud, LoaderCircle } from "lucide-react";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type SessionInfo = {
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
};
type FacebookLoginResponse = { authResponse?: { code?: string } };

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

export function EmbeddedSignupButton({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const [config, setConfig] = useState<{
    appId: string;
    configId: string;
  } | null>(null);
  const appId = config?.appId;
  const configId = config?.configId;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionInfoRef = useRef<SessionInfo>({});
  useEffect(() => {
    fetch("/api/whatsapp-accounts/embedded-config")
      .then((response) => response.json())
      .then((data) =>
        setConfig({ appId: data.appId ?? "", configId: data.configId ?? "" }),
      )
      .catch(() => setConfig({ appId: "", configId: "" }));
  }, []);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const hostname = new URL(event.origin).hostname;
      if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com"))
        return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data?.type === "WA_EMBEDDED_SIGNUP" &&
          ["FINISH", "FINISH_ONLY_WABA"].includes(data.event)
        ) {
          const info = data.data ?? {};
          sessionInfoRef.current = info;
        }
      } catch {}
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  function initialize() {
    if (!appId || !window.FB) return;
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: "v21.0",
    });
    setReady(true);
  }
  function connect() {
    if (!window.FB || !configId)
      return setError("Configure o App ID e o Config ID da Meta no ambiente.");
    setLoading(true);
    setError("");
    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError("A autorização foi cancelada ou não retornou um código.");
          setLoading(false);
          return;
        }
        const result = await fetch("/api/whatsapp-accounts/embedded-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, sessionInfo: sessionInfoRef.current }),
        });
        const data = await result.json();
        setLoading(false);
        if (!result.ok)
          return setError(data.error || "Não foi possível concluir a conexão.");
        onConnected();
      },
      {
        config_id: configId,
        scope: "whatsapp_business_management,whatsapp_business_messaging",
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }
  if (!appId || !configId) return null;
  return (
    <>
      <Script
        src="https://connect.facebook.net/pt_BR/sdk.js"
        strategy="afterInteractive"
        onLoad={initialize}
      />
      <div>
        <button
          onClick={connect}
          disabled={!ready || loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Cloud className="size-4" />
          )}
          Conectar com Facebook (Embedded Signup)
        </button>
        {error && (
          <p className="mt-2 max-w-xs text-xs text-rose-600">{error}</p>
        )}
      </div>
    </>
  );
}
