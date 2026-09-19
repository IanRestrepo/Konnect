"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KonnectMark } from "@/components/brand/logo";

/**
 * Puerta del portal.
 *
 * Deliberadamente no usa el sistema de diseño de la aplicación: quien llega
 * aquí no es del equipo, entra desde el móvil y viene de un enlace de
 * WhatsApp. Superficie propia y tipografía grande.
 *
 * No se teclea nada. El enlace personal lleva la llave dentro y abre el
 * espacio directamente; en un dispositivo donde ya se entró, basta el
 * marcador. Esta pantalla solo se ve un instante, o cuando falta el enlace.
 */

type Paso =
  /** Entrando: con el enlace o con el dispositivo recordado. */
  | "abriendo"
  /** Sin enlace y en un dispositivo que no se conoce. */
  | "sin-enlace";

type Respuesta = { error?: string };

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
  const [error, setError] = useState<string | null>(aviso ?? null);

  useEffect(() => {
    if (arranque !== "abriendo") return;
    let vivo = true;
    fetch(`/api/portal/${sessionId}/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(llave ? { code: llave } : {}),
    })
      .then(async (res) => {
        if (!vivo) return;
        if (res.ok) {
          router.refresh();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as Respuesta;
        setError(data.error ?? "No pudimos abrir el enlace.");
        setPaso("sin-enlace");
      })
      .catch(() => {
        if (!vivo) return;
        setError("No hay conexión. Revisa tu internet y vuelve a abrir el enlace.");
        setPaso("sin-enlace");
      });
    return () => {
      vivo = false;
    };
  }, [arranque, llave, sessionId, router]);

  return (
    <main className="portal-gate">
      <div className="portal-gate__glow" aria-hidden />

      <div className="portal-gate__inner">
        <header className="portal-gate__brand">
          <KonnectMark className="h-7 w-auto" />
          <span className="portal-gate__brandline">Entregas</span>
        </header>

        {paso === "abriendo" ? (
          <div className="portal-gate__form">
            <h1 className="portal-gate__titulo">Abriendo tu espacio…</h1>
            <p className="portal-gate__sub">Un momento.</p>
          </div>
        ) : (
          <div className="portal-gate__form">
            <h1 className="portal-gate__titulo">Tu espacio de entregas</h1>
            <p className="portal-gate__sub">
              Para entrar, abre el enlace personal que te mandó la agencia.
            </p>
            {error && (
              <p className="portal-aviso" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="portal-gate__pie">
        Este enlace es personal. No lo compartas: da acceso a tu material y a tus pagos.
      </p>
    </main>
  );
}
