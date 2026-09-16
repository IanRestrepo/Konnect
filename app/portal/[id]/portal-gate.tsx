"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KonnectMark } from "@/components/brand/logo";

/**
 * Puerta del portal.
 *
 * Deliberadamente no usa el sistema de diseño de la aplicación: quien llega
 * aquí no es del equipo, entra desde el móvil y viene de un enlace de
 * WhatsApp. Superficie propia, tipografía grande y campos que se sienten como
 * los de un banco, no como un formulario más.
 *
 * Ya no hay código que teclear. El enlace personal lleva la llave dentro: la
 * primera vez se elige un PIN y desde entonces se entra con él.
 */

type Paso =
  /** Llegó con el enlace: se está mirando si toca elegir PIN o escribirlo. */
  | "abriendo"
  /** Llegó sin enlace y este dispositivo no es conocido. */
  | "sin-enlace"
  /** Dispositivo conocido, sin enlace a mano: basta el PIN. */
  | "pin"
  /** Con enlace y PIN ya elegido. */
  | "pin-enlace"
  /** Con enlace, primera vez. */
  | "crear-pin";

type Respuesta = {
  error?: string;
  debeElegirPin?: boolean;
  pidePin?: boolean;
  enlaceInvalido?: boolean;
  sinEnlace?: boolean;
  label?: string;
};

export function PortalGate({
  sessionId,
  llave,
  aviso,
  arranque,
}: {
  sessionId: string;
  /** La llave del acceso que viene en el enlace (`?acceso=`). */
  llave: string | null;
  aviso?: string;
  arranque: Paso;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(arranque);
  const [nombre, setNombre] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(aviso ?? null);

  /** Lleva a la pantalla que toca según lo que contestó el servidor. */
  function seguir(data: Respuesta) {
    if (data.label) setNombre(data.label);
    if (data.enlaceInvalido || data.sinEnlace) setPaso("sin-enlace");
    else if (data.debeElegirPin) setPaso("crear-pin");
    else if (data.pidePin) setPaso(llave ? "pin-enlace" : "pin");
  }

  // Con el enlace en la mano, lo primero es saber si ya eligió PIN. No abre
  // nada: solo decide la pantalla.
  useEffect(() => {
    if (arranque !== "abriendo" || !llave) return;
    let vivo = true;
    fetch(`/api/portal/${sessionId}/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: llave }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Respuesta;
        if (!vivo) return;
        if (!res.ok) setError(data.error ?? "No pudimos abrir el enlace.");
        seguir(data);
        if (!res.ok && !data.enlaceInvalido) setPaso("sin-enlace");
      })
      .catch(() => {
        if (!vivo) return;
        setError("No hay conexión. Revisa tu internet y vuelve a abrir el enlace.");
        setPaso("sin-enlace");
      });
    return () => {
      vivo = false;
    };
    // `seguir` solo usa setters y la llave, que ya está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arranque, llave, sessionId]);

  async function enviar(cuerpo: Record<string, string>, ruta = "entrar") {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${sessionId}/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = (await res.json().catch(() => ({}))) as Respuesta;
      if (!res.ok) {
        seguir(data);
        throw new Error(data.error ?? "No pudimos validarlo.");
      }
      return data;
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="portal-gate">
      <div className="portal-gate__glow" aria-hidden />

      <div className="portal-gate__inner">
        <header className="portal-gate__brand">
          <KonnectMark className="h-7 w-auto" />
          <span className="portal-gate__brandline">Entregas</span>
        </header>

        {paso === "abriendo" && (
          <div className="portal-gate__form">
            <h1 className="portal-gate__titulo">Abriendo tu espacio…</h1>
            <p className="portal-gate__sub">Un momento.</p>
          </div>
        )}

        {paso === "sin-enlace" && (
          <div className="portal-gate__form">
            <h1 className="portal-gate__titulo">Tu espacio de entregas</h1>
            <p className="portal-gate__sub">
              Para entrar, abre el enlace personal que te mandó la agencia.
            </p>
            {error && <Aviso>{error}</Aviso>}
          </div>
        )}

        {(paso === "pin" || paso === "pin-enlace") && (
          <PasoPin
            nombre={nombre}
            cargando={cargando}
            error={error}
            onEnviar={async (pin) => {
              try {
                await enviar(llave && paso === "pin-enlace" ? { code: llave, pin } : { pin });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error inesperado");
              }
            }}
          />
        )}

        {paso === "crear-pin" && llave && (
          <PasoCrearPin
            nombre={nombre}
            cargando={cargando}
            error={error}
            onEnviar={async (pin, repetir) => {
              try {
                await enviar({ code: llave, pin, repetir }, "pin");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error inesperado");
              }
            }}
          />
        )}
      </div>

      <p className="portal-gate__pie">
        Este enlace es personal. No lo compartas: da acceso a tu material y a tus pagos.
      </p>
    </main>
  );
}

/* ---------------- Entrar con PIN ---------------- */

function PasoPin({
  nombre,
  cargando,
  error,
  onEnviar,
}: {
  nombre: string | null;
  cargando: boolean;
  error: string | null;
  onEnviar: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");

  /**
   * Envía solo al completar los cuatro dígitos, y vacía las cajas cuando el
   * PIN falla para que se pueda reintentar sin borrar a mano. Ambas cosas
   * ocurren aquí, en el propio cambio, y no en un efecto.
   */
  function escribir(valor: string) {
    setPin(valor);
    if (valor.length === 4 && !cargando) onEnviar(valor);
  }

  // Un error nuevo invalida lo tecleado: la clave identifica el intento.
  const clave = error ?? "sin-error";

  return (
    <div className="portal-gate__form">
      <h1 className="portal-gate__titulo">{nombre ? `Hola, ${nombre}` : "Hola de nuevo"}</h1>
      <p className="portal-gate__sub">Escribe tu PIN de 4 dígitos.</p>

      <PinBoxes key={clave} valor={pin} onCambio={escribir} autoFocus />

      {error && <Aviso>{error}</Aviso>}

      <p className="portal-gate__sub" style={{ marginTop: 16 }}>
        ¿Olvidaste tu PIN? Pídele a la agencia que reinicie tu acceso y te mande un enlace nuevo.
      </p>
    </div>
  );
}

/* ---------------- Elegir PIN, la primera vez ---------------- */

function PasoCrearPin({
  nombre,
  cargando,
  error,
  onEnviar,
}: {
  nombre: string | null;
  cargando: boolean;
  error: string | null;
  onEnviar: (pin: string, repetir: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [repetir, setRepetir] = useState("");
  const confirmando = pin.length === 4;

  return (
    <form
      className="portal-gate__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (repetir.length === 4) onEnviar(pin, repetir);
      }}
    >
      <h1 className="portal-gate__titulo">
        {nombre ? `Hola, ${nombre}` : "Elige tu PIN"}
      </h1>
      <p className="portal-gate__sub">
        {confirmando
          ? "Repítelo para confirmar."
          : "Elige un PIN de 4 dígitos. Lo usarás cada vez que entres."}
      </p>

      {confirmando ? (
        <PinBoxes valor={repetir} onCambio={setRepetir} autoFocus />
      ) : (
        <PinBoxes valor={pin} onCambio={setPin} autoFocus />
      )}

      {error && <Aviso>{error}</Aviso>}

      {confirmando && (
        <>
          <button className="portal-btn" type="submit" disabled={repetir.length !== 4 || cargando}>
            {cargando ? "Guardando…" : "Guardar PIN y entrar"}
          </button>
          <button
            className="portal-link"
            type="button"
            onClick={() => {
              setPin("");
              setRepetir("");
            }}
          >
            Empezar de nuevo
          </button>
        </>
      )}
    </form>
  );
}

/* ---------------- Piezas compartidas ---------------- */

function PinBoxes({
  valor,
  onCambio,
  autoFocus,
}: {
  valor: string;
  onCambio: (v: string) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="portal-pin" onClick={() => ref.current?.focus()}>
      {/* Un solo campo real detrás: el teclado numérico del móvil se comporta
          mucho mejor así que con cuatro inputs separados. */}
      <input
        ref={ref}
        className="portal-pin__real"
        value={valor}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        aria-label="PIN de 4 dígitos"
        autoFocus={autoFocus}
      />
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`portal-pin__caja${valor.length === i ? " is-activa" : ""}${
            valor[i] ? " is-llena" : ""
          }`}
          aria-hidden
        >
          {valor[i] ? "•" : ""}
        </span>
      ))}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="portal-aviso" role="alert">
      {children}
    </p>
  );
}
