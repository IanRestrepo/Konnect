"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KonnectMark } from "@/components/brand/logo";

/**
 * Puerta del portal.
 *
 * Deliberadamente no usa el sistema de diseño de la aplicación: quien llega
 * aquí no es del equipo, entra desde el móvil y viene de un enlace de
 * WhatsApp. Superficie propia, tipografía grande y campos que se sienten como
 * los de un banco, no como un formulario más.
 */

type Paso = "codigo" | "pin" | "crear-pin";

export function PortalGate({
  sessionId,
  aviso,
  arranque = "codigo",
}: {
  sessionId: string;
  aviso?: string;
  /** Si el dispositivo ya entró antes, se pide solo el PIN. */
  arranque?: Paso;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(arranque);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(aviso ?? null);

  async function enviar(cuerpo: Record<string, string>, ruta = "entrar") {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${sessionId}/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.needsCode) setPaso("codigo");
        throw new Error(data.error ?? "No pudimos validarlo.");
      }
      return data as { debeElegirPin?: boolean };
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

        {paso === "codigo" && (
          <PasoCodigo
            cargando={cargando}
            error={error}
            onEnviar={async (code) => {
              try {
                const data = await enviar({ code });
                if (data.debeElegirPin) {
                  setPaso("crear-pin");
                  setError(null);
                } else {
                  router.refresh();
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error inesperado");
              }
            }}
          />
        )}

        {paso === "pin" && (
          <PasoPin
            cargando={cargando}
            error={error}
            onEnviar={async (pin) => {
              try {
                await enviar({ pin });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error inesperado");
              }
            }}
            onUsarCodigo={() => {
              setPaso("codigo");
              setError(null);
            }}
          />
        )}

        {paso === "crear-pin" && (
          <PasoCrearPin
            cargando={cargando}
            error={error}
            onEnviar={async (pin, repetir) => {
              try {
                await enviar({ pin, repetir }, "pin");
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

/* ---------------- Paso 1: el código de la agencia ---------------- */

function PasoCodigo({
  cargando,
  error,
  onEnviar,
}: {
  cargando: boolean;
  error: string | null;
  onEnviar: (code: string) => void;
}) {
  const [bloques, setBloques] = useState(["", "", ""]);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const completo = bloques.every((b) => b.length === 4);

  function escribir(indice: number, bruto: string) {
    const limpio = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const siguiente = [...bloques];
    siguiente[indice] = limpio;
    setBloques(siguiente);
    if (limpio.length === 4 && indice < 2) refs[indice + 1].current?.focus();
  }

  /**
   * Reparte el código pegado entre los tres bloques.
   *
   * Hace falta interceptar el pegado: con `maxLength` el navegador recorta el
   * texto a cuatro caracteres *antes* de avisar del cambio, así que desde
   * `onChange` es imposible ver el código completo.
   */
  function pegar(e: React.ClipboardEvent, indice: number) {
    const texto = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (texto.length <= 4) return; // Un bloque suelto: que lo maneje onChange.

    e.preventDefault();
    const siguiente = [...bloques];
    // Empieza a repartir desde el bloque donde se pega, no siempre del primero.
    for (let i = indice, pos = 0; i < 3 && pos < texto.length; i++, pos += 4) {
      siguiente[i] = texto.slice(pos, pos + 4);
    }
    setBloques(siguiente);

    const ultimo = siguiente.findIndex((b) => b.length < 4);
    refs[ultimo === -1 ? 2 : ultimo].current?.focus();
  }

  function retroceder(indice: number, tecla: string) {
    if (tecla === "Backspace" && !bloques[indice] && indice > 0) {
      refs[indice - 1].current?.focus();
    }
  }

  return (
    <form
      className="portal-gate__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (completo) onEnviar(bloques.join(""));
      }}
    >
      <h1 className="portal-gate__titulo">Tu espacio de entregas</h1>
      <p className="portal-gate__sub">
        Escribe el código que te pasó la agencia. Solo hace falta esta primera vez.
      </p>

      <div className="portal-code" role="group" aria-label="Código de acceso">
        {bloques.map((valor, i) => (
          <div className="portal-code__par" key={i}>
            {i > 0 && <span className="portal-code__guion" aria-hidden />}
            <input
              ref={refs[i]}
              className="portal-code__campo"
              value={valor}
              onChange={(e) => escribir(i, e.target.value)}
              onPaste={(e) => pegar(e, i)}
              onKeyDown={(e) => retroceder(i, e.key)}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
              aria-label={`Bloque ${i + 1} de 3`}
              autoFocus={i === 0}
            />
          </div>
        ))}
      </div>

      {error && <Aviso>{error}</Aviso>}

      <button className="portal-btn" type="submit" disabled={!completo || cargando}>
        {cargando ? "Comprobando…" : "Entrar"}
      </button>
    </form>
  );
}

/* ---------------- Paso 2: entrar con PIN ---------------- */

function PasoPin({
  cargando,
  error,
  onEnviar,
  onUsarCodigo,
}: {
  cargando: boolean;
  error: string | null;
  onEnviar: (pin: string) => void;
  onUsarCodigo: () => void;
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
      <h1 className="portal-gate__titulo">Hola de nuevo</h1>
      <p className="portal-gate__sub">Escribe tu PIN de 4 dígitos.</p>

      <PinBoxes key={clave} valor={pin} onCambio={escribir} autoFocus />

      {error && <Aviso>{error}</Aviso>}

      <button className="portal-link" type="button" onClick={onUsarCodigo}>
        Olvidé mi PIN, usar el código de la agencia
      </button>
    </div>
  );
}

/* ---------------- Paso 3: elegir PIN ---------------- */

function PasoCrearPin({
  cargando,
  error,
  onEnviar,
}: {
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
      <h1 className="portal-gate__titulo">Elige tu PIN</h1>
      <p className="portal-gate__sub">
        {confirmando
          ? "Repítelo para confirmar."
          : "Cuatro dígitos para entrar la próxima vez, sin buscar el código."}
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
            {cargando ? "Guardando…" : "Guardar PIN"}
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
