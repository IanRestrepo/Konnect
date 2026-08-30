"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, LogOut, Upload } from "lucide-react";
import { KonnectMark } from "@/components/brand/logo";
import type { PortalRole, RequirementStatus, SessionRequirement } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Panel del creador.
 *
 * Responde a tres preguntas y nada más: qué me piden, qué ya entregué y
 * cuándo cobro. No comparte componentes con la aplicación interna a
 * propósito: aquí no hay tablas densas ni filtros, y se abre desde el móvil.
 */

export type PortalPago = {
  /** Lo que recibe el creador por esta campaña. */
  total: number;
  moneda: string;
  estado: "pendiente" | "aprobado" | "pagado";
  piezas: { titulo: string; importe: number; estado: string }[];
};

const ESTADO_PAGO: Record<PortalPago["estado"], { texto: string; nota: string }> = {
  pendiente: { texto: "Pendiente", nota: "Se aprueba cuando la agencia valide tus entregas." },
  aprobado: { texto: "Aprobado", nota: "Aprobado para pago. Entra en el próximo ciclo." },
  pagado: { texto: "Pagado", nota: "El pago ya salió." },
};

const ESTADO_CHECK: Record<RequirementStatus, string> = {
  pendiente: "Pendiente",
  enviado: "En revisión",
  cambios: "Cambios pedidos",
  aprobado: "Aprobado",
};

export function PortalView({
  sessionId,
  name,
  role,
  label,
  canUpload,
  requirements,
  pago,
}: {
  sessionId: string;
  name: string;
  role: PortalRole;
  label: string;
  canUpload: boolean;
  requirements: SessionRequirement[];
  pago: PortalPago | null;
}) {
  const router = useRouter();

  const hechos = requirements.filter((r) => r.status === "aprobado").length;
  const pendientes = requirements.filter((r) => r.status !== "aprobado");

  async function salir() {
    await fetch(`/api/portal/${sessionId}/salir`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="portal-app">
      <header className="portal-top">
        <KonnectMark className="h-6 w-auto" />
        <span className="portal-top__quien">
          {label} · {role === "creador" ? "Creador" : role === "cliente" ? "Cliente" : "Invitado"}
        </span>
        <button className="portal-salir" onClick={salir}>
          <LogOut size={13} style={{ display: "inline", marginRight: 5, verticalAlign: -2 }} />
          Salir
        </button>
      </header>

      <div className="portal-wrap">
        <h1 className="portal-hero__titulo">{name}</h1>
        <p className="portal-hero__sub">
          {requirements.length === 0
            ? "Todavía no hay nada que entregar."
            : hechos === requirements.length
              ? "Todo entregado y aprobado. No queda nada por hacer."
              : `${hechos} de ${requirements.length} aprobados · ${pendientes.length} por resolver`}
        </p>

        {/* ---------------- Lo que se pide ---------------- */}
        <section className="portal-seccion">
          <div className="portal-seccion__cabeza">
            <h2 className="portal-seccion__titulo">Lo que te pedimos</h2>
            <span className="portal-seccion__contador">{requirements.length}</span>
          </div>

          {requirements.length === 0 ? (
            <p className="portal-vacio">
              La agencia aún no cargó las peticiones. Te avisará cuando estén.
            </p>
          ) : (
            requirements.map((req) => (
              <Peticion
                key={req.id}
                sessionId={sessionId}
                req={req}
                puedeSubir={canUpload}
                onListo={() => router.refresh()}
              />
            ))
          )}
        </section>

        {/* ---------------- El pago ---------------- */}
        {pago && (
          <section className="portal-seccion">
            <div className="portal-seccion__cabeza">
              <h2 className="portal-seccion__titulo">Tu pago</h2>
            </div>

            <div className="portal-pago">
              <span className={`portal-tag ${pago.estado === "pagado" ? "pagado" : pago.estado}`}>
                {ESTADO_PAGO[pago.estado].texto}
              </span>
              <p className="portal-pago__cifra">
                {pago.moneda} {pago.total.toLocaleString("es", { maximumFractionDigits: 2 })}
              </p>
              <p className="portal-hero__sub" style={{ fontSize: 13 }}>
                {ESTADO_PAGO[pago.estado].nota}
              </p>

              {pago.piezas.map((p, i) => (
                <div className="portal-pago__linea" key={i}>
                  <span className="portal-pago__etiqueta">{p.titulo}</span>
                  <span>
                    {pago.moneda} {p.importe.toLocaleString("es", { maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------- Una petición del checklist ---------------- */

function Peticion({
  sessionId,
  req,
  puedeSubir,
  onListo,
}: {
  sessionId: string;
  req: SessionRequirement;
  puedeSubir: boolean;
  onListo: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState(req.url ?? "");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aprobado = req.status === "aprobado";
  const marca =
    req.status === "aprobado"
      ? "is-aprobado"
      : req.status === "enviado"
        ? "is-enviado"
        : req.status === "cambios"
          ? "is-cambios"
          : "";

  async function enviar() {
    if (!url.trim()) {
      setError("Pega el enlace de lo que entregas.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${sessionId}/peticiones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId: req.id, url: url.trim(), notes: notas.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos guardar la entrega.");
      setAbierto(false);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article
      className={`portal-check ${req.status === "aprobado" ? "is-aprobado" : req.status === "cambios" ? "is-cambios" : ""}`}
    >
      <span className={`portal-check__marca ${marca}`}>
        {aprobado && <Check size={14} strokeWidth={3} />}
      </span>

      <div className="portal-check__cuerpo">
        <h3 className={`portal-check__titulo ${aprobado ? "is-hecho" : ""}`}>{req.title}</h3>

        {req.instructions && <p className="portal-check__nota">{req.instructions}</p>}

        {req.steps.length > 0 && (
          <ul className="portal-pasos">
            {req.steps.map((paso, i) => (
              <li key={i}>{paso}</li>
            ))}
          </ul>
        )}

        {req.status === "cambios" && req.reviewNotes && (
          <p className="portal-revision">
            <strong>Cambios pedidos:</strong> {req.reviewNotes}
          </p>
        )}

        <div className="portal-check__pie">
          <span className={`portal-tag ${req.status}`}>{ESTADO_CHECK[req.status]}</span>

          {req.url && (
            <a className="portal-enlace" href={req.url} target="_blank" rel="noreferrer">
              {req.url}
            </a>
          )}

          {req.submittedAt && !req.url && (
            <span className="portal-seccion__contador">
              Enviado el {formatDate(req.submittedAt)}
            </span>
          )}

          {puedeSubir && !aprobado && !abierto && (
            <button
              className="portal-btn portal-btn--chico"
              style={{ marginLeft: "auto" }}
              onClick={() => setAbierto(true)}
            >
              <Upload size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
              {req.url ? "Volver a enviar" : "Subir"}
            </button>
          )}
        </div>

        {abierto && (
          <div style={{ marginTop: 12 }}>
            <label className="portal-etiqueta" htmlFor={`url-${req.id}`}>
              Enlace
            </label>
            <input
              id={`url-${req.id}`}
              className="portal-campo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
            />

            <label className="portal-etiqueta" htmlFor={`nota-${req.id}`} style={{ marginTop: 10 }}>
              Comentario (opcional)
            </label>
            <input
              id={`nota-${req.id}`}
              className="portal-campo"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Algo que la agencia deba saber"
            />

            {error && <p className="portal-aviso">{error}</p>}

            <div className="portal-check__pie">
              <button
                className="portal-btn portal-btn--chico"
                onClick={enviar}
                disabled={enviando}
              >
                {enviando && (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                    style={{ display: "inline", marginRight: 6, verticalAlign: -2 }}
                  />
                )}
                Enviar
              </button>
              <button
                className="portal-btn portal-btn--chico portal-btn--fantasma"
                onClick={() => {
                  setAbierto(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
