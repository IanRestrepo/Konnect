"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";

/** Pantalla del código. No revela nada de la sesión hasta que se acierta. */
export function PortalGate({ sessionId, aviso }: { sessionId: string; aviso?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(aviso ?? null);

  async function entrar() {
    if (!code.trim()) {
      setError("Escribe el código.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${sessionId}/entrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos validar el código.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="grid h-11 w-11 place-items-center rounded-[var(--r-control)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <KeyRound size={19} strokeWidth={1.75} />
        </div>

        <h1 className="mt-4 text-[19px] font-semibold tracking-tight">Portal de entregas</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Escribe el código que te compartieron para ver esta sesión.
        </p>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            entrar();
          }}
        >
          <Label htmlFor="portal-code">Código de acceso</Label>
          <Input
            id="portal-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7QP-2M4X-9RTB"
            autoComplete="off"
            autoFocus
            className="tabular tracking-wider"
          />
          <FieldHint>Da igual si lo escribes con o sin guiones.</FieldHint>

          <Button type="submit" variant="primary" className="mt-4 w-full" disabled={cargando}>
            {cargando && <LoaderCircle size={14} className="animate-spin" />}
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
