"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Pencil, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DefList, DefRow } from "@/components/ui/def-list";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { PersonalData } from "@/lib/types";

/** Lo mismo que los datos bancarios: a los cinco minutos se vuelve a tapar. */
const VISIBLE_MS = 5 * 60 * 1000;

/**
 * Nombre real y dirección del creador.
 *
 * Van aparte de los datos bancarios pero con la misma llave —el permiso de
 * datos sensibles y el código—, y por la misma razón: hacen falta para
 * facturar y para mandar producto, y son justo lo que no debe verse por
 * encima del hombro de quien tiene la ficha abierta. Cada vez que se revelan
 * queda en la bitácora, porque la ruta es la de los bancarios.
 */
export function PersonalDataPanel({
  creatorId,
  hasRealName,
  hasAddress,
}: {
  creatorId: string;
  hasRealName: boolean;
  hasAddress: boolean;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeVer = can("ver_datos_bancarios");
  const puedeEditar = puedeVer && can("editar_creadores");

  const [pidiendo, setPidiendo] = useState(false);
  const [code, setCode] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claro, setClaro] = useState<PersonalData | null>(null);
  const [borrador, setBorrador] = useState<PersonalData | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  function ocultar() {
    setClaro(null);
    setBorrador(null);
  }

  // Se vuelve a tapar sola. Si se estaba editando, el formulario se va con
  // los datos: sin descifrar no hay nada que corregir.
  useEffect(() => {
    if (!claro) return;
    const fin = setTimeout(() => {
      setClaro(null);
      setBorrador(null);
    }, VISIBLE_MS);
    return () => clearTimeout(fin);
  }, [claro]);

  async function revelar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/revelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo validar el código.");
      setClaro((data.personal as PersonalData) ?? { realName: "", address: "" });
      setPidiendo(false);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal: { realName: borrador.realName.trim(), address: borrador.address.trim() },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setClaro({ realName: borrador.realName.trim(), address: borrador.address.trim() });
      setBorrador(null);
      router.refresh();
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  const tapado = (tiene: boolean) =>
    tiene ? <span className="tracking-widest text-[var(--text-subtle)]">••••••••</span> : "Sin registrar";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          {puedeVer &&
            (claro ? (
              <span className="flex gap-1.5">
                {puedeEditar && !borrador && (
                  <Button variant="secondary" size="sm" onClick={() => setBorrador({ ...claro })}>
                    <Pencil size={13} />
                    Editar
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={ocultar}>
                  <EyeOff size={13} />
                  Ocultar
                </Button>
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setPidiendo(true)}>
                <Eye size={13} />
                Ver
              </Button>
            ))}
        </CardHeader>

        {borrador ? (
          <div className="space-y-3 border-t border-[var(--line)] p-4">
            <div>
              <Label htmlFor="pd-nombre">Nombre real</Label>
              <Input
                id="pd-nombre"
                value={borrador.realName}
                onChange={(e) => setBorrador({ ...borrador, realName: e.target.value })}
                placeholder="Como aparece en su documento"
              />
            </div>
            <div>
              <Label htmlFor="pd-direccion">Dirección</Label>
              <Textarea
                id="pd-direccion"
                rows={3}
                value={borrador.address}
                onChange={(e) => setBorrador({ ...borrador, address: e.target.value })}
                placeholder="Calle, número, ciudad, código postal, país"
              />
              <FieldHint>Se guarda cifrada. Déjala vacía para borrarla.</FieldHint>
            </div>
            {errorGuardar && (
              <p className="rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
                {errorGuardar}
              </p>
            )}
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setBorrador(null)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando && <Loader2 size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <DefList className="border-t border-[var(--line)]">
            <DefRow label="Nombre real">
              {claro ? claro.realName || "Sin registrar" : tapado(hasRealName)}
            </DefRow>
            <DefRow label="Dirección">
              {claro ? (
                <span className="whitespace-pre-line">{claro.address || "Sin registrar"}</span>
              ) : (
                tapado(hasAddress)
              )}
            </DefRow>
          </DefList>
        )}

        {!puedeVer && (
          <p className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3 text-[12px] text-[var(--text-subtle)]">
            <Lock size={12} />
            Tu rol no permite ver datos sensibles.
          </p>
        )}
      </Card>

      <Modal
        open={pidiendo}
        onClose={() => {
          setPidiendo(false);
          setError(null);
          setCode("");
        }}
        size="sm"
        title="Verificación requerida"
        description="Introduce el código de acceso para ver o cambiar los datos personales."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPidiendo(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={revelar} disabled={cargando || code.length < 4}>
              {cargando && <Loader2 size={13} className="animate-spin" />}
              Desbloquear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="pd-code">Código de acceso</Label>
            <Input
              id="pd-code"
              type="password"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && revelar()}
              placeholder="••••••"
              className="h-9 text-center font-mono text-[15px] tracking-[0.4em]"
            />
          </div>
          {error && (
            <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-2.5 py-2 text-[12px] text-[var(--danger)]">
              <ShieldAlert size={13} className="mt-px shrink-0" />
              {error}
            </p>
          )}
          <p className="text-[12px] text-[var(--text-subtle)]">
            Cinco intentos fallidos bloquean el acceso 10 minutos. Los datos se vuelven a tapar a
            los 5 minutos.
          </p>
        </div>
      </Modal>
    </>
  );
}
