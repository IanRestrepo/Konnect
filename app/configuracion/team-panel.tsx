"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Plus, Shield, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ALL_PERMISSIONS, PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";
import { useSession } from "@/components/session-provider";
import type { PublicUser, Role } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const COLORS = ["#0046d9", "#15794a", "#b45309", "#be185d", "#7c3aed", "#1d69d4", "#6c6c78"];

export function TeamPanel({ tab }: { tab: "usuarios" | "roles" }) {
  const session = useSession();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userDialog, setUserDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  async function load() {
    const res = await fetch("/api/usuarios");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el equipo.");
    setUsers(data.users as PublicUser[]);
    setRoles(data.roles as Role[]);
  }

  useEffect(() => {
    let vigente = true;
    fetch("/api/usuarios")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el equipo.");
        if (!vigente) return;
        setUsers(data.users as PublicUser[]);
        setRoles(data.roles as Role[]);
      })
      .catch((e) => vigente && setError(e instanceof Error ? e.message : "Error inesperado"))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, []);

  const roleById = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r])),
    [roles],
  );

  async function patchUser(id: string, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar.");
      return;
    }
    await load();
  }

  async function removeUser(id: string) {
    setError(null);
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo eliminar.");
      return;
    }
    await load();
  }

  async function removeRole(id: string) {
    setError(null);
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo eliminar el rol.");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-14">
        <LoaderCircle size={18} className="animate-spin text-[var(--text-subtle)]" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {tab === "usuarios" ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas del equipo</CardTitle>
            <Button variant="primary" size="sm" onClick={() => setUserDialog(true)}>
              <UserPlus size={14} />
              Añadir
            </Button>
          </CardHeader>

          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {users.map((user) => {
              const role = roleById[user.roleId];
              const esYo = user.id === session?.userId;
              return (
                <div key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={user.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {user.name}
                      {esYo && (
                        <span className="ml-1.5 font-normal text-[var(--text-subtle)]">(tú)</span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                      {user.email} ·{" "}
                      {user.lastLoginAt
                        ? `último acceso ${formatDate(user.lastLoginAt)}`
                        : "sin acceder aún"}
                    </p>
                  </div>

                  <Select
                    value={user.roleId}
                    onChange={(e) => patchUser(user.id, { roleId: e.target.value })}
                    className="h-8 w-40 text-[12.5px]"
                    aria-label={`Rol de ${user.name}`}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>

                  <button
                    onClick={() => patchUser(user.id, { active: !user.active })}
                    className="shrink-0"
                    title={user.active ? "Desactivar cuenta" : "Activar cuenta"}
                  >
                    <Badge tone={user.active ? "ok" : "neutral"}>
                      {user.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </button>

                  <button
                    onClick={() => removeUser(user.id)}
                    disabled={esYo}
                    aria-label={`Eliminar a ${user.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>

                  {role && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: role.color }}
                      title={role.name}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Roles y permisos</CardTitle>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingRole(null);
                setRoleDialog(true);
              }}
            >
              <Plus size={14} />
              Nuevo rol
            </Button>
          </CardHeader>

          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {roles.map((role) => {
              const todos = role.permissions.includes(ALL_PERMISSIONS);
              const cuantos = todos ? PERMISSIONS.length : role.permissions.length;
              const miembros = users.filter((u) => u.roleId === role.id).length;
              return (
                <div key={role.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)]"
                    style={{ background: `${role.color}1f`, color: role.color }}
                  >
                    <Shield size={15} strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {role.name}
                      {role.system && (
                        <span className="ml-2 text-[11px] font-normal text-[var(--text-subtle)]">
                          del sistema
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                      {todos ? "Todos los permisos" : `${cuantos} permisos`} · {miembros}{" "}
                      {miembros === 1 ? "miembro" : "miembros"}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingRole(role);
                      setRoleDialog(true);
                    }}
                  >
                    {role.system ? "Ver" : "Editar"}
                  </Button>

                  <button
                    onClick={() => removeRole(role.id)}
                    disabled={role.system}
                    aria-label={`Eliminar ${role.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <NewUserDialog
        open={userDialog}
        roles={roles}
        onClose={() => setUserDialog(false)}
        onSaved={load}
      />
      <RoleDialog
        open={roleDialog}
        role={editingRole}
        onClose={() => setRoleDialog(false)}
        onSaved={load}
      />
    </div>
  );
}

/* ---------------- Alta de usuario ---------------- */

function NewUserDialog({
  open,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleId = form.roleId || roles.find((r) => !r.system)?.id || roles[0]?.id || "";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la cuenta.");
      await onSaved();
      setForm({ name: "", email: "", password: "", roleId: "" });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Añadir cuenta"
      description="El empleado entrará con este correo y contraseña."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Crear cuenta
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}
        <div>
          <Label htmlFor="u-name">Nombre</Label>
          <Input
            id="u-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre y apellido"
          />
        </div>
        <div>
          <Label htmlFor="u-email">Correo</Label>
          <Input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="persona@agencia.com"
          />
        </div>
        <div>
          <Label htmlFor="u-pass">Contraseña temporal</Label>
          <Input
            id="u-pass"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
          <FieldHint>Compártela por un canal seguro; se guarda cifrada con scrypt.</FieldHint>
        </div>
        <div>
          <Label htmlFor="u-role">Rol</Label>
          <Select
            id="u-role"
            value={roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Rol y sus permisos ---------------- */

function RoleDialog({
  open,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Carga los valores del rol al abrir, sin useEffect: se sincroniza al render.
  const key = role?.id ?? "nuevo";
  if (open && hydratedFor !== key) {
    setHydratedFor(key);
    setName(role?.name ?? "");
    setColor(role?.color ?? COLORS[0]);
    setPermissions(role?.permissions.filter((p) => p !== ALL_PERMISSIONS) ?? []);
    setError(null);
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  const bloqueado = Boolean(role?.system);

  function toggle(id: string) {
    setPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(role ? `/api/roles/${role.id}` : "/api/roles", {
        method: role ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el rol.");
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={role ? `Rol: ${role.name}` : "Nuevo rol"}
      description={
        bloqueado
          ? "Este rol del sistema siempre tiene todos los permisos."
          : "Marca lo que este rol puede ver y hacer."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {bloqueado ? "Cerrar" : "Cancelar"}
          </Button>
          {!bloqueado && (
            <Button variant="primary" onClick={save} disabled={saving || name.trim().length < 2}>
              {saving && <LoaderCircle size={14} className="animate-spin" />}
              Guardar rol
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="r-name">Nombre del rol</Label>
            <Input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Community manager"
              disabled={bloqueado}
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "h-8 w-8 rounded-[var(--r-control)] transition disabled:opacity-50",
                    color === c && "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {PERMISSION_GROUPS.map((group) => {
            const items = PERMISSIONS.filter((p) => p.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="eyebrow mb-1.5">{group}</p>
                <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)]">
                  {items.map((permission) => {
                    const activo = bloqueado || permissions.includes(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        disabled={bloqueado}
                        onClick={() => toggle(permission.id)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[var(--surface-2)] disabled:pointer-events-none"
                      >
                        <span
                          className={cn(
                            "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition",
                            activo
                              ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg)]"
                              : "border-[var(--line-strong)]",
                          )}
                        >
                          {activo && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium">
                            {permission.label}
                          </span>
                          <span className="block text-[11.5px] text-[var(--text-subtle)]">
                            {permission.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
