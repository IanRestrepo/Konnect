"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, LoaderCircle, Plus, TriangleAlert, X } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { PORTAL_ROLE, SESSION_STATUS } from "@/lib/labels";
import type { CollabSession, PortalRole, SessionStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Opcion = { id: string; name: string };
type Filtro = SessionStatus | "todas";
type AccesoBorrador = { role: PortalRole; label: string; canUpload: boolean };

const ACCESOS_INICIALES: AccesoBorrador[] = [
  { role: "creador", label: "", canUpload: true },
  { role: "cliente", label: "", canUpload: false },
];

export function SessionsView({
  sessions,
  campaigns,
  creators,
}: {
  sessions: CollabSession[];
  campaigns: Opcion[];
  creators: Opcion[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [open, setOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    campaignId: "",
    creatorId: "",
    notes: "",
    showMetrics: true,
  });
  const [accesos, setAccesos] = useState<AccesoBorrador[]>(ACCESOS_INICIALES);

  const filtros = useMemo<{ id: Filtro; label: string; count: number }[]>(
    () => [
      { id: "todas", label: "Todas", count: sessions.length },
      {
        id: "abierta",
        label: "Abiertas",
        count: sessions.filter((s) => s.status === "abierta").length,
      },
      {
        id: "cerrada",
        label: "Cerradas",
        count: sessions.filter((s) => s.status === "cerrada").length,
      },
    ],
    [sessions],
  );

  const nombreCreador = useMemo(
    () => new Map(creators.map((c) => [c.id, c.name])),
    [creators],
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filtro !== "todas" && s.status !== filtro) return false;
      if (!q) return true;
      const creador = s.creatorId ? (nombreCreador.get(s.creatorId) ?? "") : "";
      const etiquetas = s.accesses.map((a) => a.label).join(" ");
      return [s.name, creador, etiquetas].join(" ").toLowerCase().includes(q);
    });
  }, [sessions, query, filtro, nombreCreador]);

  function abrir() {
    setForm({ name: "", campaignId: "", creatorId: "", notes: "", showMetrics: true });
    setAccesos(ACCESOS_INICIALES.map((a) => ({ ...a })));
    setError(null);
    setOpen(true);
  }

  async function crear() {
    const limpios = accesos.filter((a) => a.label.trim());
    if (!form.name.trim()) {
      setError("Falta el nombre de la sesión.");
      return;
    }
    if (!limpios.length) {
      setError("Ponle nombre a por lo menos un acceso.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          campaignId: form.campaignId || null,
          creatorId: form.creatorId || null,
          notes: form.notes,
          showMetrics: form.showMetrics,
          accesses: limpios.map((a) => ({ ...a, label: a.label.trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la sesión.");

      setOpen(false);
      router.push(`/sesiones/${data.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sesiones"
        description="Espacios compartidos con el creador y el cliente para cada entrega."
        actions={
          puedeEditar && (
            <Button variant="accent" size="lg" onClick={abrir}>
              <Plus size={16} />
              Nueva sesión
            </Button>
          )
        }
      />

      <Toolbar>
        <Segmented options={filtros} value={filtro} onChange={setFiltro} />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre, creador o acceso…"
        />
      </Toolbar>

      {visibles.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={sessions.length === 0 ? "Todavía no hay sesiones" : "Sin resultados"}
          description={
            sessions.length === 0
              ? "Una sesión es el espacio donde el creador sube su material y el cliente lo revisa, cada uno con su propio código."
              : "Ajusta los filtros o prueba con otro nombre."
          }
          action={
            puedeEditar && (
              <Button variant="accent" onClick={abrir}>
                <Plus size={16} />
                Nueva sesión
              </Button>
            )
          }
        />
      ) : (
        <ListBox>
          {visibles.map((s) => {
            const estado = SESSION_STATUS[s.status];
            const vivos = s.accesses.filter((a) => !a.revoked);
            const creador = s.creatorId ? nombreCreador.get(s.creatorId) : null;

            return (
              <ListRow
                key={s.id}
                href={`/sesiones/${s.id}`}
                leading={
                  <RowIcon>
                    <FolderKanban size={17} strokeWidth={1.75} />
                  </RowIcon>
                }
                title={s.name}
                subtitle={[creador, `${s.items.length} elementos`, formatDate(s.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <span className="flex items-center gap-4">
                    <span className="hidden text-right sm:block">
                      <span className="tabular block text-[14px] font-semibold">{vivos.length}</span>
                      <span className="block text-[11.5px] text-[var(--text-subtle)]">accesos</span>
                    </span>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                  </span>
                }
              />
            );
          })}
        </ListBox>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva sesión"
        description="Cada acceso recibe su propio código. Podrás copiarlos al terminar."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={crear} disabled={guardando}>
              {guardando && <LoaderCircle size={14} className="animate-spin" />}
              Crear sesión
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="se-name">Nombre</Label>
            <Input
              id="se-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Lanzamiento verano · Zerflox"
            />
          </div>

          <div>
            <Label htmlFor="se-campaign">Campaña</Label>
            <Select
              id="se-campaign"
              value={form.campaignId}
              onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
            >
              <option value="">Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="se-creator">Creador</Label>
            <Select
              id="se-creator"
              value={form.creatorId}
              onChange={(e) => setForm({ ...form, creatorId: e.target.value })}
            >
              <option value="">Sin creador</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Accesos</Label>
          <FieldHint>Uno por cada persona o empresa a la que le pases el enlace.</FieldHint>

          <div className="mt-1.5 space-y-2">
            {accesos.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={a.role}
                  onChange={(e) =>
                    setAccesos((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, role: e.target.value as PortalRole } : x,
                      ),
                    )
                  }
                  className="w-32 shrink-0"
                  aria-label="Tipo de acceso"
                >
                  {Object.entries(PORTAL_ROLE).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>

                <Input
                  value={a.label}
                  onChange={(e) =>
                    setAccesos((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  placeholder="A quién se lo das"
                  aria-label="Nombre del acceso"
                />

                <label className="flex shrink-0 items-center gap-1.5 px-1 text-[12.5px] text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={a.canUpload}
                    onChange={(e) =>
                      setAccesos((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, canUpload: e.target.checked } : x)),
                      )
                    }
                  />
                  Sube
                </label>

                <button
                  type="button"
                  onClick={() => setAccesos((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar acceso"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() =>
              setAccesos((prev) => [...prev, { role: "invitado", label: "", canUpload: false }])
            }
          >
            <Plus size={14} />
            Añadir acceso
          </Button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={form.showMetrics}
            onChange={(e) => setForm({ ...form, showMetrics: e.target.checked })}
          />
          Mostrar las métricas del creador dentro del portal
        </label>

        <div className="mt-3">
          <Label htmlFor="se-notes">Notas</Label>
          <Textarea
            id="se-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Lo que verá quien entre al portal."
          />
        </div>
      </Modal>
    </div>
  );
}
