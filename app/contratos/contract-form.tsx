"use client";

import { useState, type FormEvent } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { CURRENCIES } from "@/lib/labels";

export function ContractForm() {
  const [tipo, setTipo] = useState("empresa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function descargar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const datos = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!response.ok || response.headers.get("content-type") !== "application/pdf") {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudo generar el contrato. Vuelve a intentarlo.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `contrato-konnect-${datos.tipo}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el contrato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Nuevo contrato</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={descargar}>
          <Field label="Tipo de contrato" htmlFor="tipo">
            <Select id="tipo" name="tipo" value={tipo} onChange={(event) => setTipo(event.target.value)}>
              <option value="empresa">Konnect – Empresa</option>
              <option value="influencer">Konnect – Influencer</option>
            </Select>
          </Field>
          <Field label={tipo === "empresa" ? "Nombre de la empresa" : "Nombre del influencer"} htmlFor="contraparte">
            <Input key={tipo} id="contraparte" name="contraparte" required maxLength={180} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Valor pactado" htmlFor="valor">
              <Input id="valor" name="valor" type="number" inputMode="decimal" min="0.01" max="999999999999.99" step="0.01" required />
            </Field>
            <Field label="Moneda" htmlFor="moneda">
              <Select id="moneda" name="moneda" defaultValue="USD">
                {CURRENCIES.map((moneda) => <option key={moneda}>{moneda}</option>)}
              </Select>
            </Field>
          </div>
          {error && <p role="alert" className="text-[13px] text-[var(--danger)]">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>
            <FileDown size={16} />{busy ? "Generando…" : "Descargar contrato"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
