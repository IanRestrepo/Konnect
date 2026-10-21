"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Check, X } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import type { TeamNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cada cuánto se miran los avisos con la aplicación abierta. */
const CADA_MS = 45_000;

/** Lo emite cualquier pantalla que marque avisos como leídos, para refrescar ya. */
export const EVENTO_AVISOS = "konnect:avisos";

type EstadoPush = "no-soportado" | "sin-configurar" | "bloqueado" | "inactivo" | "activo";

type Contexto = {
  unread: number;
  items: TeamNotification[];
  push: EstadoPush;
  /** iPhone o iPad fuera de la pantalla de inicio: ahí el push no existe. */
  pideInstalar: boolean;
  activarPush: () => Promise<void>;
  desactivarPush: () => Promise<void>;
  abrir: (n: TeamNotification) => void;
  leerTodo: () => Promise<void>;
};

const AvisosContext = createContext<Contexto | null>(null);

/** La clave VAPID llega en base64 de URL; `subscribe` la quiere en bytes. */
function claveEnBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

function soportaPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Avisos del equipo: la campana, el push del dispositivo y el aviso en
 * pantalla cuando llega algo nuevo con la aplicación abierta.
 *
 * Vive una sola vez en el marco de la aplicación. El riel lateral y el menú
 * del teléfono se montan los dos aunque uno esté oculto, y si cada campana
 * preguntara por su cuenta habría dos sondeos y dos avisos en pantalla.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<TeamNotification[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [push, setPush] = useState<EstadoPush>("inactivo");
  const [pideInstalar, setPideInstalar] = useState(false);
  /** Lo que llegó mientras la aplicación estaba abierta y aún no se ha mirado. */
  const [nuevos, setNuevos] = useState<TeamNotification[]>([]);
  const vistos = useRef<Set<string> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/avisos", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        unread: number;
        items: TeamNotification[];
        publicKey: string | null;
      };
      setUnread(data.unread);
      setItems(data.items);
      setPublicKey(data.publicKey);

      // La primera carga solo apunta lo que ya había: lo «nuevo» es lo que
      // llega después, no lo que estaba esperando al abrir la aplicación.
      if (vistos.current === null) {
        vistos.current = new Set(data.items.map((n) => n.id));
        return;
      }
      const recien = data.items.filter((n) => !n.readAt && !vistos.current!.has(n.id));
      for (const n of data.items) vistos.current.add(n.id);
      if (recien.length) setNuevos((prev) => [...recien, ...prev].slice(0, 3));
    } catch {
      // Sin red, se vuelve a intentar en la siguiente vuelta.
    }
  }, []);

  useEffect(() => {
    // Primera carga al montar; después, el sondeo y al volver a la pestaña.
    const primera = setTimeout(cargar, 0);
    const id = setInterval(cargar, CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_AVISOS, cargar);
    return () => {
      clearTimeout(primera);
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_AVISOS, cargar);
    };
  }, [cargar]);

  // El número de avisos en la pestaña del navegador, como hace el correo. Se
  // repone al navegar, porque cada página pone su propio título.
  useEffect(() => {
    const poner = () => {
      const base = document.title.replace(/^\(\d+\)\s*/, "");
      document.title = unread > 0 ? `(${unread}) ${base}` : base;
    };
    poner();
    const t = setTimeout(poner, 300);
    return () => clearTimeout(t);
  }, [unread, pathname]);

  // Estado del push en este dispositivo.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!soportaPush()) {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (vivo) {
          setPush("no-soportado");
          setPideInstalar(ios);
        }
        return;
      }
      if (!publicKey) {
        if (vivo) setPush("sin-configurar");
        return;
      }
      if (Notification.permission === "denied") {
        if (vivo) setPush("bloqueado");
        return;
      }
      const registro = await navigator.serviceWorker.register("/sw.js");
      const sub = await registro.pushManager.getSubscription();
      if (!vivo) return;
      if (sub && Notification.permission === "granted") {
        setPush("activo");
        // Se vuelve a mandar: si la cuenta cambió en este navegador, o la base
        // perdió la suscripción, así se recupera sin que nadie toque nada.
        void fetch("/api/avisos/suscripcion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } else {
        setPush("inactivo");
      }
    })().catch(() => vivo && setPush("inactivo"));
    return () => {
      vivo = false;
    };
  }, [publicKey]);

  const activarPush = useCallback(async () => {
    if (!soportaPush() || !publicKey) return;
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      setPush(permiso === "denied" ? "bloqueado" : "inactivo");
      return;
    }
    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveEnBytes(publicKey),
      }));
    const res = await fetch("/api/avisos/suscripcion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setPush(res.ok ? "activo" : "inactivo");
  }, [publicKey]);

  const desactivarPush = useCallback(async () => {
    if (!soportaPush()) return;
    const registro = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await registro?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/avisos/suscripcion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setPush("inactivo");
  }, []);

  const abrir = useCallback(
    (n: TeamNotification) => {
      setNuevos((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.readAt) {
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
        );
        void fetch("/api/avisos/leidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [n.id] }),
        });
      }
      router.push(n.url);
    },
    [router],
  );

  const leerTodo = useCallback(async () => {
    setNuevos([]);
    setUnread(0);
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    await fetch("/api/avisos/leidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  }, []);

  return (
    <AvisosContext.Provider
      value={{ unread, items, push, pideInstalar, activarPush, desactivarPush, abrir, leerTodo }}
    >
      {children}

      {/* Lo nuevo, en pantalla y sin irse solo: si nadie lo toca, sigue ahí. */}
      {nuevos.length > 0 && (
        <div className="fixed top-3 right-3 z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2">
          {nuevos.map((n) => (
            <div
              key={n.id}
              role="alert"
              className="flex items-start gap-3 rounded-[var(--r-card)] border border-[var(--accent)] bg-[var(--surface)] p-3 shadow-[var(--shadow-pop)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <BellRing size={15} />
              </span>
              <button type="button" onClick={() => abrir(n)} className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-semibold">{n.title}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">{n.body}</span>
              </button>
              <button
                type="button"
                onClick={() => setNuevos((prev) => prev.filter((x) => x.id !== n.id))}
                aria-label="Cerrar aviso"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-chip)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </AvisosContext.Provider>
  );
}

function hace(fecha: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

/** La línea de arriba del panel: cómo está el push en este dispositivo. */
function EstadoDispositivo() {
  const ctx = useContext(AvisosContext)!;
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } finally {
      setOcupado(false);
    }
  };

  const texto: Record<EstadoPush, string> = {
    activo: "Este dispositivo recibe los avisos aunque Konnect esté cerrado.",
    inactivo: "Activa los avisos para enterarte aunque Konnect esté cerrado.",
    bloqueado:
      "El navegador tiene los avisos bloqueados para Konnect. Permítelos en el candado de la barra de direcciones.",
    "sin-configurar": "Los avisos push aún no están configurados en el servidor.",
    "no-soportado": ctx.pideInstalar
      ? "En iPhone, añade Konnect a la pantalla de inicio (Compartir → Añadir a inicio) y ábrelo desde ahí para recibir avisos."
      : "Este navegador no admite avisos push.",
  };

  return (
    <div className="flex items-start gap-2 border-b border-[var(--line)] px-3 py-2.5">
      {ctx.push === "activo" ? (
        <BellRing size={14} className="mt-0.5 shrink-0 text-[var(--ok)]" />
      ) : (
        <BellOff size={14} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
      )}
      <p className="min-w-0 flex-1 text-[12px] text-[var(--text-muted)]">{texto[ctx.push]}</p>
      {ctx.push === "inactivo" && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => correr(ctx.activarPush)}
          className="shrink-0 rounded-[var(--r-chip)] bg-[var(--solid)] px-2.5 py-1 text-[12px] font-medium text-[var(--solid-fg)] disabled:opacity-50"
        >
          Activar
        </button>
      )}
      {ctx.push === "activo" && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => correr(ctx.desactivarPush)}
          className="shrink-0 text-[12px] text-[var(--text-subtle)] transition hover:text-[var(--text)] disabled:opacity-50"
        >
          Desactivar
        </button>
      )}
    </div>
  );
}

/**
 * La campana. Va en el riel lateral y en el menú del teléfono; el estado lo
 * lleva `NotificationsProvider`.
 */
export function NotificationBell({
  side = "right",
  align = "end",
  className,
}: {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const ctx = useContext(AvisosContext);
  if (!ctx) return null;

  return (
    <Popover
      side={side}
      align={align}
      className="w-[min(360px,calc(100vw-24px))]"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={ctx.unread ? `Avisos: ${ctx.unread} sin leer` : "Avisos"}
          className={cn(
            "relative grid place-items-center text-[var(--text-subtle)] transition hover:text-[var(--text)]",
            className,
          )}
        >
          <Bell size={18} strokeWidth={1.75} />
          {ctx.unread > 0 && (
            <span className="tabular absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] leading-none font-semibold text-white">
              {ctx.unread > 9 ? "9+" : ctx.unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-[13px] font-semibold">Avisos</span>
            {ctx.unread > 0 && (
              <button
                type="button"
                onClick={() => void ctx.leerTodo()}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                <Check size={12} />
                Marcar todo leído
              </button>
            )}
          </div>
          <EstadoDispositivo />
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {ctx.items.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-[var(--text-muted)]">
                Sin avisos. Cuando un creador entregue o suba algo, aparece aquí.
              </p>
            ) : (
              ctx.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    close();
                    ctx.abrir(n);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-[var(--r-control)] px-2.5 py-2 text-left transition hover:bg-[var(--surface-3)]",
                    !n.readAt && "bg-[var(--surface-2)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-[var(--accent)]",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[12.5px]", !n.readAt && "font-semibold")}>
                      {n.title}
                    </span>
                    <span className="block text-[11.5px] text-[var(--text-muted)]">
                      {hace(n.createdAt)}
                      {n.reminders > 0 && !n.readAt && ` · insistido ${n.reminders} ${n.reminders === 1 ? "vez" : "veces"}`}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
