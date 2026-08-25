"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Megaphone, Plus, Terminal, Trash2, TriangleAlert } from "lucide-react";
import { PageTitle, SectionHead } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { PERMISSIONS } from "@/lib/permissions";
import type { Announcement, AnnouncementTone } from "@/lib/types";
import { cn } from "@/lib/utils";

type RolOpcion = { id: string; name: string; color: string };

const TONOS: { id: AnnouncementTone; label: string; clase: string }[] = [
  { id: "info", label: "Info", clase: "bg-[var(--info-soft)] text-[var(--info)]" },
  { id: "ok", label: "Bien", clase: "bg-[var(--ok-soft)] text-[var(--ok)]" },
  { id: "warn", label: "Aviso", clase: "bg-[var(--warn-soft)] text-[var(--warn)]" },
  { id: "danger", label: "Alerta", clase: "bg-[var(--danger-soft)] text-[var(--danger)]" },
];

/** Solo los módulos que tiene sentido apagar: las páginas. */
const MODULOS = PERMISSIONS.filter((p) => p.group === "Páginas");

export function DeveloperView({
  announcements,
  disabled,
  roles,
}: {
  announcements: Announcement[];
  disabled: string[];
  roles: RolOpcion[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    message: "",
    tone: "info" as AnnouncementTone,
    roleIds: [] as string[],
    dismissible: true,
    active: true,
  });

  async function llamar(cuerpo: unknown, fallo: string) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch("/api/developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? fallo);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ message: "", tone: "info", roleIds: [], dismissible: true, active: true });
    setError(null);
    setOpen(true);
  }

  function abrirEdicion(a: Announcement) {
    setEditando(a);
    setForm({
      message: a.message,
      tone: a.tone,
      roleIds: a.roleIds,
      dismissible: a.dismissible,
      active: a.active,
    });
    setError(null);
    setOpen(true);
  }

  async function guardar() {
    if (!form.message.trim()) {
      setError("Escribe el mensaje.");
      return;
    }
    const ok = await llamar(
      { accion: "aviso", id: editando?.id, ...form, message: form.message.trim() },
      "No se pudo guardar el aviso.",
    );
    if (ok) setOpen(false);
  }

  function alternarModulo(key: string) {
    const next = disabled.includes(key)
      ? disabled.filter((k) => k !== key)
      : [...disabled, key];
    llamar({ accion: "modulos", disabled: next }, "No se pudo cambiar el módulo.");
  }

  return (
    <div className="space-y-7">
      <PageTitle
        eyebrow="Solo tú ves esta página"
        title="Developer"
        description="Control por encima de la administración: qué se ve y qué se anuncia."
        actions={
          <Button variant="accent" size="lg" onClick={abrirNuevo}>
            <Plus size={16} />
            Nuevo aviso
          </Button>
        }
      />

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <SectionHead title="Avisos" hint="Se muestran dentro de la aplicación, arriba." />

          {announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Sin avisos"
              description="Publica un banner y lo verá quien tú decidas."
              action={
                <Button variant="accent" onClick={abrirNuevo}>
                  <Plus size={16} />
                  Nuevo aviso
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {announcements.map((a) => {
                const tono = TONOS.find((t) => t.id === a.tone)!;
                return (
                  <Card key={a.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "shrink-0 rounded-[var(--r-chip)] px-2 py-0.5 text-[11.5px] font-medium",
                          tono.clase,
                        )}
                      >
                        {tono.label}
                      </span>
                      <button
                        onClick={() => abrirEdicion(a)}
                        className="min-w-0 flex-1 text-left text-[13px] leading-relaxed hover:text-[var(--accent)]"
                      >
                        {a.message}
                      </button>
                      <Switch
                        checked={a.active}
                        busy={ocupado}
                        label={a.active ? "Visible" : "Apagado"}
                        onChange={(next) =>
                          llamar(
                            {
                              accion: "aviso",
                              id: a.id,
                              message: a.message,
                              tone: a.tone,
                              roleIds: a.roleIds,
                              dismissible: a.dismissible,
                              active: next,
                            },
                            "No se pudo cambiar el aviso.",
                          )
                        }
                      />
                      <button
                        onClick={() => llamar({ accion: "borrar_aviso", id: a.id }, "No se pudo borrar.")}
                        aria-label="Borrar aviso"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-chip)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-[var(--text-subtle)]">
                      {a.roleIds.length
                        ? `Solo: ${a.roleIds
                            .map((id) => roles.find((r) => r.id === id)?.name ?? id)
                            .join(", ")}`
                        : "Todo el equipo"}
                      {a.dismissible ? " · se puede cerrar" : " · fijo"}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionHead
            title="Módulos"
            hint="Apagar uno lo cierra para todos, administración incluida. Tú sigues entrando."
          />

          <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
            {MODULOS.map((m) => {
              const apagado = disabled.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {m.label}
                      {apagado && <Badge tone="danger">Apagado</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">
                      {m.description}
                    </p>
                  </div>
                  <Switch
                    checked={!apagado}
                    busy={ocupado}
                    label={apagado ? `Encender ${m.label}` : `Apagar ${m.label}`}
                    onChange={() => alternarModulo(m.id)}
                  />
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-start gap-2 text-[12px] text-[var(--text-subtle)]">
            <EyeOff size={13} className="mt-0.5 shrink-0" />
            El módulo apagado desaparece del menú y su página redirige al panel, aunque quien
            entre sea administrador.
          </p>
        </section>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={editando ? Megaphone : Terminal}
        title={editando ? "Editar aviso" : "Nuevo aviso"}
        description="Aparece arriba, dentro de la aplicación, para quien tú decidas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={ocupado}>
              Publicar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="av-msg">Mensaje</Label>
            <Input
              id="av-msg"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="El viernes la app estará en mantenimiento de 8 a 10."
              maxLength={300}
            />
          </div>

          <div>
            <Label>Tono</Label>
            <div className="flex flex-wrap gap-1.5">
              {TONOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, tone: t.id })}
                  aria-pressed={form.tone === t.id}
                  className={cn(
                    "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                    form.tone === t.id
                      ? `border-transparent ${t.clase}`
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Quién lo ve</Label>
            <FieldHint>Sin marcar nada, lo ve todo el equipo.</FieldHint>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {roles.map((rol) => {
                const activo = form.roleIds.includes(rol.id);
                return (
                  <button
                    key={rol.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        roleIds: activo
                          ? form.roleIds.filter((r) => r !== rol.id)
                          : [...form.roleIds, rol.id],
                      })
                    }
                    aria-pressed={activo}
                    className={cn(
                      "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                      activo
                        ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                    )}
                  >
                    {rol.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={form.dismissible}
              onChange={(e) => setForm({ ...form, dismissible: e.target.checked })}
            />
            Se puede cerrar
          </label>
        </div>
      </Modal>
    </div>
  );
}
