"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { SlashCommand } from "@/components/notes/slash-command";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  LoaderCircle,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Editor de notas.
 *
 * Tiptap es headless a propósito: la barra y el menú se pintan con los tokens
 * de la aplicación en vez de traer una interfaz ajena que habría que pelear
 * para que encajara.
 *
 * El contenido viaja dos veces al guardar —el árbol para editar y el texto
 * plano para buscar— porque Postgres no sabe leer un documento de ProseMirror.
 */
export function NoteEditor({
  content,
  editable = true,
  onChange,
}: {
  content: unknown;
  editable?: boolean;
  onChange?: (content: unknown, plainText: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  /**
   * Sube la imagen y la inserta donde estaba el cursor.
   *
   * Se hace en dos pasos —subir y luego insertar— y no con un marcador
   * temporal: si la subida falla, la nota no se queda con un hueco roto.
   */
  const subirImagen = useCallback(async (archivo: File, editor: Editor) => {
    setSubiendo(true);
    setFallo(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);

      const res = await fetch("/api/notas/imagen", { method: "POST", body: cuerpo });
      const texto = await res.text();
      let data: { url?: string; error?: string } = {};
      try {
        data = texto ? JSON.parse(texto) : {};
      } catch {
        // Cuerpo no-JSON: nos quedamos con el código de estado.
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `No se pudo subir la imagen (error ${res.status}).`);
      }

      editor.chain().focus().setImage({ src: data.url, alt: archivo.name }).run();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "Error inesperado al subir.");
    } finally {
      setSubiendo(false);
    }
  }, []);

  const editor = useEditor({
    editable,
    // El servidor no debe pintarlo: evita el aviso de hidratación de Tiptap.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Placeholder.configure({
        placeholder: "Escribe, o pulsa «/» para los bloques…",
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false }),
      SlashCommand,
    ],
    content: (content as object) ?? "",
    onUpdate: ({ editor }) => onChange?.(editor.getJSON(), editor.getText()),
    editorProps: {
      attributes: {
        class: "nota-prosa focus:outline-none",
      },

      // Pegar una captura: el portapapeles trae el archivo, no una URL.
      handlePaste: (view, event) => {
        const archivos = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (archivos.length === 0) return false;

        event.preventDefault();
        const actual = editorRef.current;
        if (actual) archivos.forEach((f) => subirImagen(f, actual));
        return true;
      },

      // Arrastrar desde el escritorio.
      handleDrop: (view, event) => {
        const archivos = Array.from(
          (event as DragEvent).dataTransfer?.files ?? [],
        ).filter((f) => f.type.startsWith("image/"));
        if (archivos.length === 0) return false;

        event.preventDefault();
        const actual = editorRef.current;
        if (actual) archivos.forEach((f) => subirImagen(f, actual));
        return true;
      },
    },
  });

  // Los manejadores de pegado se crean al construir el editor, antes de que
  // exista: esta referencia les da acceso a él sin rehacer la configuración.
  // Se sincroniza en un efecto porque escribir en una ref durante el render
  // rompe las reglas de los hooks.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  if (!editor) {
    return <div className="h-40 animate-pulse rounded-[var(--r-card)] bg-[var(--surface-2)]" />;
  }

  return (
    <div>
      {editable && <Barra editor={editor} onImagen={(f) => subirImagen(f, editor)} />}

      {subiendo && (
        <p className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]">
          <LoaderCircle size={13} className="animate-spin" />
          Subiendo imagen…
        </p>
      )}
      {fallo && (
        <p className="mb-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {fallo}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

/* ---------------- Barra de formato ---------------- */

function Barra({ editor, onImagen }: { editor: Editor; onImagen: (archivo: File) => void }) {
  const archivoRef = useRef<HTMLInputElement>(null);

  // Tiptap avisa de sus cambios fuera de React: sin esto los botones no se
  // marcarían como activos al mover el cursor.
  const [, refrescar] = useState(0);

  useEffect(() => {
    const tick = () => refrescar((n) => n + 1);
    editor.on("selectionUpdate", tick);
    editor.on("transaction", tick);
    return () => {
      editor.off("selectionUpdate", tick);
      editor.off("transaction", tick);
    };
  }, [editor]);

  function enlazar() {
    const previo = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enlace", previo ?? "https://");
    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-0.5 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] p-1">
      <Boton
        activo={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        titulo="Título"
      >
        <Heading1 size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        titulo="Subtítulo"
      >
        <Heading2 size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        titulo="Apartado"
      >
        <Heading3 size={15} />
      </Boton>

      <Separador />

      <Boton
        activo={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        titulo="Negrita"
      >
        <Bold size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        titulo="Cursiva"
      >
        <Italic size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        titulo="Tachado"
      >
        <Strikethrough size={15} />
      </Boton>
      <Boton activo={editor.isActive("link")} onClick={enlazar} titulo="Enlace">
        <Link2 size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("image")}
        onClick={() => archivoRef.current?.click()}
        titulo="Imagen"
      >
        <ImagePlus size={15} />
      </Boton>
      {/* También se puede pegar o arrastrar: esto es para quien prefiere el
          selector de archivos de siempre. */}
      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onImagen(archivo);
          e.target.value = "";
        }}
      />

      <Separador />

      <Boton
        activo={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        titulo="Lista"
      >
        <List size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        titulo="Lista numerada"
      >
        <ListOrdered size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        titulo="Casillas"
      >
        <ListTodo size={15} />
      </Boton>

      <Separador />

      <Boton
        activo={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        titulo="Cita"
      >
        <Quote size={15} />
      </Boton>
      <Boton
        activo={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        titulo="Código"
      >
        <Code size={15} />
      </Boton>
    </div>
  );
}

function Boton({
  children,
  activo,
  onClick,
  titulo,
}: {
  children: React.ReactNode;
  activo: boolean;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[var(--r-chip)] transition",
        activo
          ? "bg-[var(--surface-3)] text-[var(--text)]"
          : "text-[var(--text-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

function Separador() {
  return <span className="mx-1 h-5 w-px bg-[var(--line)]" aria-hidden />;
}
