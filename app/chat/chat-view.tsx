"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Hash,
  Lock,
  MessagesSquare,
  Plus,
  Send,
  Settings2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { ChatMessage, ChatRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

type RolOpcion = { id: string; name: string; color: string };

/** Cada cuánto se pregunta por mensajes nuevos con la pestaña a la vista. */
const SONDEO_MS = 5000;

const COLORES = ["#0046d9", "#15794a", "#a16207", "#be123c", "#6d28d9", "#0e7490"];

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function diaLargo(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "long" });
}

export function ChatView({
  rooms,
  activeRoomId,
  initialMessages,
  roles,
  me,
}: {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  initialMessages: ChatMessage[];
  roles: RolOpcion[];
  me: { id: string; name: string };
}) {
  const router = useRouter();
  const can = useCan();
  const puedeGestionar = can("gestionar_chat");

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salaOpen, setSalaOpen] = useState(false);
  const [editando, setEditando] = useState<ChatRoom | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: COLORES[0],
    roleIds: [] as string[],
  });

  const finRef = useRef<HTMLDivElement | null>(null);
  const activa = rooms.find((r) => r.id === activeRoomId) ?? null;

  // Al cambiar de sala, el servidor manda otro historial y hay que soltar el
  // anterior. Se ajusta durante el render, no en un efecto: así no hay un
  // parpadeo con los mensajes de la sala que acabamos de dejar.
  const [salaCargada, setSalaCargada] = useState(activeRoomId);
  if (salaCargada !== activeRoomId) {
    setSalaCargada(activeRoomId);
    setMessages(initialMessages);
  }

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeRoomId]);

  /**
   * Trae solo lo posterior al último mensaje que ya tenemos. Se detiene cuando
   * la pestaña no está a la vista: así la base se duerme fuera de horario en
   * vez de estar despierta las 24 horas.
   */
  const traerNuevos = useCallback(async () => {
    if (!activeRoomId || document.visibilityState !== "visible") return;

    const ultimo = messages[messages.length - 1]?.createdAt;
    try {
      const url = new URL(`/api/chat/salas/${activeRoomId}/mensajes`, window.location.origin);
      if (ultimo) url.searchParams.set("desde", ultimo);

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as { messages: ChatMessage[] };
      if (data.messages.length) {
        setMessages((prev) => {
          const vistos = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !vistos.has(m.id))];
        });
      }
    } catch {
      // Un fallo de red puntual no debe romper la sala: se reintenta solo.
    }
  }, [activeRoomId, messages]);

  useEffect(() => {
    const id = setInterval(traerNuevos, SONDEO_MS);
    const alVolver = () => document.visibilityState === "visible" && traerNuevos();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [traerNuevos]);

  async function enviar() {
    const texto = borrador.trim();
    if (!texto || !activeRoomId || enviando) return;

    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/salas/${activeRoomId}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar.");

      setMessages((prev) => [...prev, data.message as ChatMessage]);
      setBorrador("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  async function borrarMensaje(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/chat/salas/${activeRoomId}/mensajes?mensaje=${id}`, { method: "DELETE" });
  }

  function abrirNueva() {
    setEditando(null);
    setForm({ name: "", description: "", color: COLORES[0], roleIds: [] });
    setError(null);
    setSalaOpen(true);
  }

  function abrirEdicion(room: ChatRoom) {
    setEditando(room);
    setForm({
      name: room.name,
      description: room.description,
      color: room.color,
      roleIds: room.roleIds,
    });
    setError(null);
    setSalaOpen(true);
  }

  async function guardarSala() {
    if (!form.name.trim()) {
      setError("Falta el nombre de la sala.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(
        editando ? `/api/chat/salas/${editando.id}` : "/api/chat/salas",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, name: form.name.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la sala.");

      setSalaOpen(false);
      router.replace(`/chat?sala=${editando ? editando.id : data.room.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  async function archivar(room: ChatRoom) {
    await fetch(`/api/chat/salas/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !room.archived }),
    });
    router.refresh();
  }

  async function eliminarSala(room: ChatRoom) {
    await fetch(`/api/chat/salas/${room.id}`, { method: "DELETE" });
    setSalaOpen(false);
    router.replace("/chat");
    router.refresh();
  }

  /** Mensajes agrupados por día, y dentro por autor si van seguidos. */
  const bloques = useMemo(() => {
    const dias: { dia: string; grupos: { autor: string; propio: boolean; msgs: ChatMessage[] }[] }[] =
      [];

    for (const m of messages) {
      const dia = diaLargo(m.createdAt);
      let ultimoDia = dias[dias.length - 1];
      if (!ultimoDia || ultimoDia.dia !== dia) {
        ultimoDia = { dia, grupos: [] };
        dias.push(ultimoDia);
      }

      const ultimoGrupo = ultimoDia.grupos[ultimoDia.grupos.length - 1];
      const seguido =
        ultimoGrupo &&
        ultimoGrupo.autor === m.authorName &&
        new Date(m.createdAt).getTime() -
          new Date(ultimoGrupo.msgs[ultimoGrupo.msgs.length - 1].createdAt).getTime() <
          5 * 60 * 1000;

      if (seguido) ultimoGrupo.msgs.push(m);
      else
        ultimoDia.grupos.push({
          autor: m.authorName,
          propio: m.authorId === me.id,
          msgs: [m],
        });
    }

    return dias;
  }, [messages, me.id]);

  const activas = rooms.filter((r) => !r.archived);
  const archivadas = rooms.filter((r) => r.archived);

  return (
    <div className="flex h-[calc(100dvh-theme(spacing.4))] gap-4">
      {/* ---- Salas ---- */}
      <aside className="hidden w-60 shrink-0 flex-col rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] md:flex">
        <div className="flex items-center justify-between gap-2 px-4 py-3.5">
          <h2 className="text-[14px] font-semibold">Salas</h2>
          {puedeGestionar && (
            <Button variant="secondary" size="sm" onClick={abrirNueva} aria-label="Nueva sala">
              <Plus size={14} />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--line)] p-2">
          {activas.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              activa={room.id === activeRoomId}
              onEditar={puedeGestionar ? () => abrirEdicion(room) : undefined}
            />
          ))}

          {archivadas.length > 0 && (
            <>
              <p className="mt-3 mb-1 px-2 text-[11px] font-medium tracking-wide text-[var(--text-subtle)] uppercase">
                Archivadas
              </p>
              {archivadas.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  activa={room.id === activeRoomId}
                  onEditar={puedeGestionar ? () => abrirEdicion(room) : undefined}
                />
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ---- Conversación ---- */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
        {!activa ? (
          <div className="grid flex-1 place-items-center p-6">
            <EmptyState
              icon={MessagesSquare}
              title="Todavía no hay salas"
              description="Crea la primera sala para que el equipo empiece a hablar."
              action={
                puedeGestionar && (
                  <Button variant="accent" onClick={abrirNueva}>
                    <Plus size={16} />
                    Nueva sala
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)]"
                style={{ backgroundColor: `${activa.color}1a`, color: activa.color }}
              >
                {activa.roleIds.length ? <Lock size={15} /> : <Hash size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-semibold">{activa.name}</h1>
                {activa.description && (
                  <p className="truncate text-[12px] text-[var(--text-muted)]">
                    {activa.description}
                  </p>
                )}
              </div>
              {activa.archived && <Badge tone="warn">Archivada</Badge>}
              {puedeGestionar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEdicion(activa)}
                  aria-label="Ajustes de la sala"
                >
                  <Settings2 size={15} />
                </Button>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">
                  Nadie ha escrito todavía. Rompe el hielo.
                </p>
              )}

              {bloques.map((dia) => (
                <div key={dia.dia} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-[var(--line)]" />
                    <span className="text-[11.5px] text-[var(--text-subtle)]">{dia.dia}</span>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                  </div>

                  {dia.grupos.map((grupo, i) => (
                    <div key={`${grupo.autor}-${i}`} className="flex gap-3">
                      <Avatar name={grupo.autor} size={32} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold">{grupo.autor}</span>
                          <span className="text-[11.5px] text-[var(--text-subtle)]">
                            {horaCorta(grupo.msgs[0].createdAt)}
                          </span>
                        </p>
                        {grupo.msgs.map((m) => (
                          <div key={m.id} className="group flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                              {m.body}
                            </p>
                            {(grupo.propio || puedeGestionar) && (
                              <button
                                onClick={() => borrarMensaje(m.id)}
                                aria-label="Borrar mensaje"
                                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-chip)] text-[var(--text-subtle)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div ref={finRef} />
            </div>

            {error && (
              <p className="mx-4 mb-2 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
                <TriangleAlert size={14} className="mt-px shrink-0" />
                {error}
              </p>
            )}

            <div className="border-t border-[var(--line)] p-3">
              {activa.archived ? (
                <p className="py-2 text-center text-[12.5px] text-[var(--text-muted)]">
                  Esta sala está archivada. Reactívala para volver a escribir.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter envía; Shift+Enter hace salto de línea.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviar();
                      }
                    }}
                    rows={1}
                    placeholder={`Escribe en ${activa.name}…`}
                    className="min-h-10 flex-1"
                    aria-label="Mensaje"
                  />
                  <Button
                    variant="accent"
                    onClick={enviar}
                    disabled={!borrador.trim() || enviando}
                    aria-label="Enviar"
                  >
                    <Send size={15} />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Modal
        open={salaOpen}
        onClose={() => setSalaOpen(false)}
        icon={editando ? Settings2 : Plus}
        title={editando ? "Ajustes de la sala" : "Nueva sala"}
        description="Sin roles marcados entra todo el equipo. Administración entra siempre."
        footerNote={
          editando ? (
            <button
              onClick={() => eliminarSala(editando)}
              className="text-[var(--danger)] hover:underline"
            >
              Eliminar sala
            </button>
          ) : undefined
        }
        footer={
          <>
            {editando && (
              <Button variant="ghost" onClick={() => archivar(editando)}>
                <Archive size={14} />
                {editando.archived ? "Reactivar" : "Archivar"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSalaOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarSala} disabled={enviando}>
              Guardar
            </Button>
          </>
        }
      >
        {error && (
          <p className="mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="sala-name">Nombre</Label>
            <Input
              id="sala-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="general"
            />
          </div>

          <div>
            <Label htmlFor="sala-desc">Descripción</Label>
            <Input
              id="sala-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="De qué se habla aquí"
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color === c}
                  className={cn(
                    "h-7 w-7 rounded-[var(--r-chip)] border-2 transition",
                    form.color === c ? "border-[var(--text)]" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Quién entra</Label>
            <FieldHint>Sin marcar nada, la sala es del equipo entero.</FieldHint>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {roles.map((rol) => {
                const activo = form.roleIds.includes(rol.id);
                return (
                  <button
                    key={rol.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        roleIds: activo
                          ? form.roleIds.filter((r) => r !== rol.id)
                          : [...form.roleIds, rol.id],
                      })
                    }
                    aria-pressed={activo}
                    className={cn(
                      "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                      activo
                        ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                    )}
                  >
                    {rol.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RoomRow({
  room,
  activa,
  onEditar,
}: {
  room: ChatRoom;
  activa: boolean;
  onEditar?: () => void;
}) {
  return (
    <div className="group/room relative">
      <a
        href={`/chat?sala=${room.id}`}
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--r-control)] px-2.5 py-2 transition",
          activa ? "bg-[var(--surface-3)]" : "hover:bg-[var(--surface-2)]",
        )}
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-chip)]"
          style={{ backgroundColor: `${room.color}1a`, color: room.color }}
        >
          {room.roleIds.length ? <Lock size={12} /> : <Hash size={12} />}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            activa ? "font-semibold" : "text-[var(--text-muted)]",
            room.archived && "opacity-60",
          )}
        >
          {room.name}
        </span>
        {room.messageCount > 0 && (
          <span className="tabular text-[11px] text-[var(--text-subtle)]">
            {room.messageCount}
          </span>
        )}
      </a>

      {onEditar && (
        <button
          onClick={onEditar}
          aria-label={`Ajustes de ${room.name}`}
          className="absolute top-1/2 right-1.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[var(--r-chip)] bg-[var(--surface)] text-[var(--text-subtle)] opacity-0 transition group-hover/room:opacity-100 hover:text-[var(--text)]"
        >
          <Settings2 size={12} />
        </button>
      )}
    </div>
  );
}
