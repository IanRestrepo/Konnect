"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CornerUpLeft,
  Mail,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { MAILBOX, THREADS, type MessageLabel, type Thread } from "@/lib/messages-mock";
import { cn } from "@/lib/utils";

type Folder = "recibidos" | "enviados" | "archivados";

const FOLDERS: { id: Folder; label: string }[] = [
  { id: "recibidos", label: "Recibidos" },
  { id: "enviados", label: "Enviados" },
  { id: "archivados", label: "Archivados" },
];

const LABEL_TONE: Record<MessageLabel, "accent" | "info" | "warn" | "ok" | "neutral"> = {
  campaña: "accent",
  negociación: "info",
  factura: "warn",
  brief: "neutral",
  contrato: "ok",
};

function shortTime(iso: string) {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(date);
}

function fullTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MessagesView() {
  const [folder, setFolder] = useState<Folder>("recibidos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(THREADS[0]?.id ?? null);
  /** En teléfono solo cabe un panel: o la lista, o la conversación. */
  const [readingOnPhone, setReadingOnPhone] = useState(false);

  const threads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THREADS.filter((t) => {
      if (t.folder !== folder) return false;
      if (!q) return true;
      return `${t.subject} ${t.counterpart} ${t.counterpartEmail}`.toLowerCase().includes(q);
    }).sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity));
  }, [folder, query]);

  const selected: Thread | null =
    threads.find((t) => t.id === selectedId) ?? threads[0] ?? null;

  return (
    <div className="flex h-full">
      {/* ---------------- Columna de conversaciones ---------------- */}
      <div
        className={cn(
          "w-full shrink-0 flex-col border-r border-[var(--line)] md:flex md:w-[300px] lg:w-[336px]",
          readingOnPhone ? "hidden" : "flex",
        )}
      >
        <div className="shrink-0 px-4 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.03em]">Mensajes</h1>
            <span className="truncate text-[11.5px] text-[var(--text-subtle)]">{MAILBOX}</span>
          </div>

          <div className="relative mt-3">
            <Search
              size={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="h-8 w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] pr-3 pl-8 text-[12.5px] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--line-strong)]"
            />
          </div>

          <div className="mt-3 flex items-center gap-4 border-b border-[var(--line)]">
            {FOLDERS.map((f) => {
              const count = THREADS.filter(
                (t) => t.folder === f.id && t.unread && f.id === "recibidos",
              ).length;
              const active = folder === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "relative -mb-px flex items-center gap-1.5 pb-2.5 text-[12.5px] transition",
                    active
                      ? "font-medium text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="tabular rounded-[var(--r-pill)] bg-[var(--accent-soft)] px-1.5 py-px text-[11px] font-medium text-[var(--accent)]">
                      {count}
                    </span>
                  )}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--text)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12.5px] text-[var(--text-muted)]">
              Nada en esta carpeta.
            </p>
          ) : (
            threads.map((thread) => {
              const active = selected?.id === thread.id;
              const preview = thread.messages[thread.messages.length - 1]?.body[0] ?? "";
              return (
                <button
                  key={thread.id}
                  onClick={() => {
                    setSelectedId(thread.id);
                    setReadingOnPhone(true);
                  }}
                  className={cn(
                    "relative flex w-full gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left transition",
                    active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-[var(--accent)]" />
                  )}

                  <span className="relative shrink-0">
                    <Avatar name={thread.counterpart} size={30} muted={!thread.unread} />
                    {thread.unread && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          thread.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {thread.counterpart}
                      </span>
                      {thread.starred && (
                        <Star size={11} className="shrink-0 fill-[var(--warn)] text-[var(--warn)]" />
                      )}
                      <span className="shrink-0 text-[11px] text-[var(--text-subtle)]">
                        {shortTime(thread.lastActivity)}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[12.5px]",
                        thread.unread ? "text-[var(--text)]" : "text-[var(--text-muted)]",
                      )}
                    >
                      {thread.subject}
                    </span>

                    <span className="mt-px block truncate text-[12px] text-[var(--text-subtle)]">
                      {preview}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------- Conversación ---------------- */}
      {selected ? (
        <div
          className={cn(
            "min-w-0 flex-1 flex-col md:flex",
            readingOnPhone ? "flex" : "hidden",
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <button
                onClick={() => setReadingOnPhone(false)}
                className="mb-2 -ml-1 inline-flex items-center gap-1.5 rounded-[var(--r-control)] px-1 py-0.5 text-[12.5px] text-[var(--text-muted)] md:hidden"
              >
                <ArrowLeft size={14} />
                Conversaciones
              </button>
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.03em] sm:text-[19px]">
                {selected.subject}
              </h2>
              <p className="mt-1 truncate text-[12.5px] text-[var(--text-muted)]">
                {selected.counterpart} · {selected.counterpartEmail}
                {selected.relatedTo && (
                  <>
                    {" · "}
                    <Link
                      href={selected.relatedTo.href}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {selected.relatedTo.name}
                    </Link>
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selected.labels.map((label) => (
                  <Badge key={label} tone={LABEL_TONE[label]} plain>
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {[
                { icon: Star, label: "Destacar" },
                { icon: Archive, label: "Archivar" },
                { icon: Trash2, label: "Eliminar" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  disabled
                  aria-label={label}
                  title={`${label} — al conectar el correo`}
                  className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] opacity-50"
                >
                  <Icon size={15} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {selected.messages.map((message, index) => (
              <article
                key={message.id}
                className={cn(
                  "px-4 py-5 sm:px-6",
                  index > 0 && "border-t border-[var(--line)]",
                  message.outgoing && "bg-[var(--surface-2)]",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={message.from} size={26} muted={message.outgoing} />
                  <p className="min-w-0 flex-1 truncate text-[12.5px]">
                    <span className="font-medium">{message.from}</span>
                    <span className="ml-1.5 text-[var(--text-subtle)]">{message.fromEmail}</span>
                  </p>
                  <span className="shrink-0 text-[11.5px] text-[var(--text-subtle)]">
                    {fullTime(message.sentAt)}
                  </span>
                </div>

                <div className="mt-3 max-w-[68ch] space-y-2.5 pl-[36px] text-[13.5px] leading-[1.65] text-[var(--text)]">
                  {message.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <footer className="shrink-0 border-t border-[var(--line)] px-4 py-3 pb-24 sm:px-6 md:pb-3">
            <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
              <CornerUpLeft size={15} className="shrink-0 text-[var(--text-subtle)]" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-subtle)]">
                Responder a {selected.counterpart}
              </span>
              <button
                disabled
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--r-chip)] bg-[var(--solid)] px-2.5 text-[12px] font-medium text-[var(--solid-fg)] opacity-40"
              >
                Enviar
                <Send size={12} strokeWidth={2} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
              Vista previa: redactar y enviar se activan al conectar el correo de GoDaddy.
            </p>
          </footer>
        </div>
      ) : (
        <div className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 md:flex">
          <Mail size={20} strokeWidth={1.5} className="text-[var(--text-subtle)]" />
          <p className="text-[13px] text-[var(--text-muted)]">Selecciona una conversación</p>
        </div>
      )}
    </div>
  );
}
