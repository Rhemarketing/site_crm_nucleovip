"use client";

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Clock3, MessageSquare, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Conversation = {
  id: string;
  lastMessageAt: string;
  unreadCount: number;
  contact: {
    name: string;
    phone: string;
    avatarUrl: string | null;
    customFields: unknown;
    contactTags: Array<{ tag: { id: string; name: string; color: string } }>;
  };
  assignedUser: { id: string; name: string } | null;
  messages: Array<{ content: string; createdAt: string }>;
};
type Stage = {
  id: string;
  name: string;
  color: string;
  order: number;
  conversations: Conversation[];
};

function elapsed(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
function estimatedValue(fields: unknown) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return null;
  const value =
    (fields as Record<string, unknown>).estimatedValue ??
    (fields as Record<string, unknown>).valorEstimado;
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;
}

export function KanbanBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/pipeline/stages", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setStages(data.stages);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const events = new EventSource("/api/chat/stream");
    events.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          ["PIPELINE_UPDATED", "CONVERSATION_UPDATED", "NEW_MESSAGE"].includes(
            data.type,
          )
        )
          void load();
      } catch {}
    };
    return () => {
      window.clearTimeout(timer);
      events.close();
    };
  }, [load]);
  async function move(result: DropResult) {
    if (!result.destination) return;
    const sourceStage = stages.find(
      (stage) => stage.id === result.source.droppableId,
    );
    const destinationStage = stages.find(
      (stage) => stage.id === result.destination?.droppableId,
    );
    if (!sourceStage || !destinationStage) return;
    const conversation = sourceStage.conversations[result.source.index];
    const next = stages.map((stage) => ({
      ...stage,
      conversations: [...stage.conversations],
    }));
    const source = next.find((stage) => stage.id === sourceStage.id)!;
    const destination = next.find((stage) => stage.id === destinationStage.id)!;
    source.conversations.splice(result.source.index, 1);
    destination.conversations.splice(result.destination.index, 0, conversation);
    setStages(next);
    const response = await fetch("/api/pipeline/move", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversation.id,
        targetStageId: destination.id,
        newOrder: result.destination.index,
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Não foi possível mover a conversa.");
      await load();
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Funil de atendimento</h1>
        <p className="mt-1 text-sm text-slate-500">
          Arraste as oportunidades entre as etapas do processo comercial.
        </p>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </header>
      <DragDropContext onDragEnd={(result) => void move(result)}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-3">
          {stages.map((stage) => (
            <section
              key={stage.id}
              className="flex w-80 shrink-0 flex-col rounded-2xl bg-slate-100/80"
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h2 className="font-semibold">{stage.name}</h2>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                  {stage.conversations.length}
                </span>
              </div>
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-32 flex-1 space-y-3 overflow-y-auto px-3 pb-3 ${snapshot.isDraggingOver ? "bg-emerald-50/70" : ""}`}
                  >
                    {stage.conversations.map((conversation, index) => (
                      <Draggable
                        key={conversation.id}
                        draggableId={conversation.id}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <article
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`rounded-xl border bg-white p-4 shadow-sm ${dragSnapshot.isDragging ? "rotate-1 border-emerald-300 shadow-xl" : "border-slate-200"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-slate-900">
                                  {conversation.contact.name}
                                </h3>
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                  <Phone className="size-3" />
                                  {conversation.contact.phone}
                                </p>
                              </div>
                              {conversation.unreadCount > 0 && (
                                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                                  {conversation.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                              {conversation.messages[0]?.content ||
                                "Sem mensagens"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {conversation.contact.contactTags
                                .slice(0, 3)
                                .map(({ tag }) => (
                                  <span
                                    key={tag.id}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      color: tag.color,
                                      backgroundColor: `${tag.color}18`,
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                            </div>
                            {estimatedValue(
                              conversation.contact.customFields,
                            ) && (
                              <p className="mt-3 text-sm font-bold text-emerald-700">
                                {estimatedValue(
                                  conversation.contact.customFields,
                                )}
                              </p>
                            )}
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                {conversation.assignedUser ? (
                                  <UserRound className="size-3" />
                                ) : null}
                                {conversation.assignedUser?.name ||
                                  "Não atribuído"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock3 className="size-3" />
                                {elapsed(conversation.lastMessageAt)}
                              </span>
                            </div>
                            <Link
                              href={`/dashboard/chat?conversationId=${conversation.id}`}
                              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              <MessageSquare className="size-3.5" />
                              Abrir conversa
                            </Link>
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
