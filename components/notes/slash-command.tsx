"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Text,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Menú de bloques con «/».
 *
 * Sin tippy ni floating-ui: la posición sale del rectángulo que ya da el
 * plugin de sugerencias, y el panel se ancla al documento para que no lo
 * recorte ningún contenedor con `overflow`.
 */

type Comando = {
  titulo: string;
  atajo: string;
  icono: LucideIcon;
  /** Palabras por las que también se encuentra. */
  alias: string[];
  ejecutar: (editor: Editor, range: Range) => void;
};

const COMANDOS: Comando[] = [
  {
    titulo: "Texto",
    atajo: "Párrafo normal",
    icono: Text,
    alias: ["parrafo", "texto", "normal"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    titulo: "Título",
    atajo: "Encabezado grande",
    icono: Heading1,
    alias: ["titulo", "h1", "encabezado"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
  },
  {
    titulo: "Subtítulo",
    atajo: "Encabezado mediano",
    icono: Heading2,
    alias: ["subtitulo", "h2"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    titulo: "Apartado",
    atajo: "Encabezado pequeño",
    icono: Heading3,
    alias: ["apartado", "h3"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    titulo: "Lista",
    atajo: "Viñetas",
    icono: List,
    alias: ["lista", "vinetas", "bullet"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    titulo: "Lista numerada",
    atajo: "1, 2, 3…",
    icono: ListOrdered,
    alias: ["numerada", "ordenada", "numeros"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    titulo: "Casillas",
    atajo: "Lista de tareas",
    icono: ListTodo,
    alias: ["casillas", "tareas", "todo", "check"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    titulo: "Cita",
    atajo: "Bloque citado",
    icono: Quote,
    alias: ["cita", "quote"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    titulo: "Código",
    atajo: "Bloque de código",
    icono: Code,
    alias: ["codigo", "code"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    titulo: "Separador",
    atajo: "Línea horizontal",
    icono: Minus,
    alias: ["separador", "linea", "hr", "divisor"],
    ejecutar: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

/* ---------------- El panel ---------------- */

type PanelProps = {
  items: Comando[];
  command: (item: Comando) => void;
};

export type PanelRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const Panel = forwardRef<PanelRef, PanelProps>(function Panel({ items, command }, ref) {
  const [marcado, setMarcado] = useState(0);

  // Al escribir cambia la lista: volver arriba evita elegir a ciegas.
  useEffect(() => setMarcado(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setMarcado((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setMarcado((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[marcado]) command(items[marcado]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-60 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px] text-[var(--text-subtle)] shadow-[var(--shadow-pop)]">
        Ningún bloque coincide.
      </div>
    );
  }

  return (
    <div className="max-h-72 w-60 overflow-y-auto rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]">
      {items.map((item, i) => {
        const Icono = item.icono;
        return (
          <button
            key={item.titulo}
            onMouseEnter={() => setMarcado(i)}
            onClick={() => command(item)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2 py-1.5 text-left transition",
              i === marcado ? "bg-[var(--surface-3)]" : "bg-transparent",
            )}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-chip)] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)]">
              <Icono size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{item.titulo}</span>
              <span className="block truncate text-[11.5px] text-[var(--text-subtle)]">
                {item.atajo}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

/* ---------------- La extensión ---------------- */

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        /**
         * En cualquier punto, no solo al principio de línea: es como funciona
         * Notion y es lo que espera quien viene de allí. A cambio, una fecha
         * como 12/05 abre el menú un instante; basta seguir escribiendo o
         * pulsar Escape.
         */
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: Comando;
        }) => props.ejecutar(editor, range),
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }) => {
          const q = normalizar(query);
          if (!q) return COMANDOS;
          return COMANDOS.filter(
            (c) =>
              normalizar(c.titulo).includes(q) || c.alias.some((a) => normalizar(a).includes(q)),
          );
        },

        render: () => {
          let componente: ReactRenderer<PanelRef, PanelProps> | null = null;
          let caja: HTMLDivElement | null = null;

          /** Coloca el panel bajo el cursor, volteándolo si no cabe abajo. */
          const colocar = (rect: DOMRect | null) => {
            if (!caja || !rect) return;
            const alto = caja.offsetHeight;
            const margen = 8;

            const abajo = rect.bottom + 6;
            const cabe = abajo + alto < window.innerHeight - margen;

            caja.style.top = `${cabe ? abajo : rect.top - alto - 6}px`;
            caja.style.left = `${Math.min(rect.left, window.innerWidth - 248)}px`;
          };

          return {
            onStart: (props: {
              editor: Editor;
              clientRect?: (() => DOMRect | null) | null;
            }) => {
              componente = new ReactRenderer(Panel, { props, editor: props.editor });

              caja = document.createElement("div");
              caja.style.position = "fixed";
              caja.style.zIndex = "100";
              caja.appendChild(componente.element);
              document.body.appendChild(caja);

              colocar(props.clientRect?.() ?? null);
            },

            onUpdate: (props: { clientRect?: (() => DOMRect | null) | null }) => {
              componente?.updateProps(props);
              colocar(props.clientRect?.() ?? null);
            },

            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (props.event.key === "Escape") {
                caja?.remove();
                return true;
              }
              return componente?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              caja?.remove();
              caja = null;
              componente?.destroy();
              componente = null;
            },
          };
        },
      }),
    ];
  },
});

/** Sin acentos y en minúsculas: buscar «codigo» debe encontrar «Código». */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
