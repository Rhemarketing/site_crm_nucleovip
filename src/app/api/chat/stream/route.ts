import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { getTenantEventsChannel } from "@/lib/chat-events";
import { createRedisConnection } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  let session;

  try {
    session = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const subscriber = createRedisConnection();
  const channel = getTenantEventsChannel(session.tenantId);
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        subscriber.removeAllListeners();

        try {
          await subscriber.unsubscribe(channel);
        } catch {
          // A conexao pode ja ter sido encerrada pelo cliente.
        }

        subscriber.disconnect(false);
      };

      const onMessage = (receivedChannel: string, message: string) => {
        if (receivedChannel !== channel || closed) return;

        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          void close();
        }
      };

      request.signal.addEventListener("abort", () => void close(), { once: true });
      subscriber.on("message", onMessage);

      try {
        await subscriber.subscribe(channel);
        controller.enqueue(encoder.encode("retry: 1000\n\n"));
        controller.enqueue(
          encoder.encode(`event: connected\ndata: {"tenantId":"${session.tenantId}"}\n\n`),
        );
        heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 15_000);
      } catch (error) {
        console.error("Falha ao assinar canal SSE", error);
        await close();
        controller.error(error);
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      closed = true;
      subscriber.removeAllListeners();
      subscriber.disconnect(false);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
