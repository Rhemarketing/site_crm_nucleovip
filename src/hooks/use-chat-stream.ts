"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatEvent } from "@/types/chat";

export function useChatStream(onEvent: (event: ChatEvent) => void) {
  const callbackRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/chat/stream", { withCredentials: true });

      source.addEventListener("connected", () => {
        attempt = 0;
        setConnected(true);
      });

      source.onmessage = (message) => {
        try {
          callbackRef.current(JSON.parse(message.data) as ChatEvent);
        } catch (error) {
          console.error("Evento de chat invalido", error);
        }
      };

      source.onerror = () => {
        setConnected(false);
        source?.close();
        attempt += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return { connected };
}
