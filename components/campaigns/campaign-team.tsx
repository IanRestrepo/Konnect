"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { cn } from "@/lib/utils";

export type Empleado = { id: string; name: string; avatarUrl: string | null };

/** Valor del desplegable cuando no hay responsable. */
const SIN_RESPONSABLE = "";

/**
 * Quién lleva la campaña y quién más anda en ella.
 *
 * La asignación es informativa por defecto: sirve para saber a quién
 * preguntarle. Solo restringe el acceso a las cuentas cuyo rol tenga
 * «Solo sus campañas»; se hizo así para que activar esto no le quite el
 * acceso a nadie el día que se despliega.
 */
export function CampaignTeam({
  campaignId,
  managerId,
  memberIds,
  empleados,
}: {
  campaignId: string;
  managerId: string | null;
  memberIds: string[];
  empleados: Empleado[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeAsignar = can("asignar_campanas");

  const [editando, setEditando] = useState(false);
  const [manager, setManager] = useState(managerId ?? SIN_RESPONSABLE);
  const [miembros, setMiembros] = useState<string[]>(memberIds);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const responsable = empleados.find((e) => e.id === managerId) ?? null;
  const encargados = memberIds
    .map((id) => empleados.find((e) => e.id === id))
    .filter((e): e is Empleado => Boolean(e));

  function empezar() {
    setManager(managerId ?? SIN_RESPONSABLE);
    setMiembros(memberIds);
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/equipo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId: manager || null,
          memberIds: miembros,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el equipo.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card style={editando ? { overflow: "visible" } : undefined}>
      <CardHeader>
        <CardTitle>Equipo</CardTitle>
        {puedeAsignar &&
          (editando ? (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando && <LoaderCircle size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={empezar}>
              {responsable || encargados.length ? "Editar" : "Asignar"}
            </Button>
          ))}
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {editando ? (
        <div className="space-y-3 border-t border-[var(--line)] p-4">
          <div>
            <Label htmlFor="eq-manager">Responsable</Label>
            <Picker
              id="eq-manager"
              value={manager}
              onChange={setManager}
              options={[
                { id: SIN_RESPONSABLE, label: "Sin responsable" },
                ...empleados.map((e) => ({ id: e.id, label: e.name })),
              ]}
            />
            <FieldHint>Es a quien se le pregunta cuando el cliente pregunta.</FieldHint>
          </div>

          <div>
            <Label>Encargados</Label>
            <div className="flex flex-wrap gap-1.5">
              {empleados
                .filter((e) => e.id !== manager)
                .map((e) => {
                  const activo = miembros.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() =>
                        setMiembros((prev) =>
                          prev.includes(e.id)
                            ? prev.filter((x) => x !== e.id)
                            : [...prev, e.id],
                        )
                      }
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border pr-3 pl-1 text-[12.5px] font-medium transition",
                        activo
                          ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      <Avatar src={e.avatarUrl} name={e.name} size={22} />
                      {e.name}
                    </button>
                  );
                })}
            </div>
            <FieldHint>
              El responsable ya alcanza la campaña por serlo; no hace falta marcarlo aquí.
            </FieldHint>
          </div>
        </div>
      ) : !responsable && encargados.length === 0 ? (
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
          Sin asignar. Nadie figura como responsable de esta campaña.
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {responsable && (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <Avatar src={responsable.avatarUrl} name={responsable.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {responsable.name}
              </span>
              <Badge tone="accent">Responsable</Badge>
            </div>
          )}
          {encargados.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar src={e.avatarUrl} name={e.name} size={28} muted />
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.name}</span>
              <Badge plain>Encargado</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
