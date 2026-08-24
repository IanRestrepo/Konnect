"use client";

import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label } from "@/components/ui/field";

type Status = {
  configured: boolean;
  source: "entorno" | "aplicación" | null;
  hint: string | null;
};

export function YoutubePanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/configuracion");
    const data = await res.json();
    setStatus(data.youtube as Status);
  }

  useEffect(() => {
    let vigente = true;
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        if (vigente) setStatus(data.youtube as Status);
      })
      .catch(() => {
        if (vigente) setStatus(null);
      });
    return () => {
      vigente = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeApiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setKey("");
      await load();
      setMessage({ tone: "ok", text: "Clave guardada." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Error inesperado" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/youtube/prueba", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "La prueba falló.");
      setMessage({ tone: "ok", text: data.message });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Error inesperado" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube Data API</CardTitle>
        {status?.configured ? (
          <Badge tone="ok">Conectada ({status.source})</Badge>
        ) : (
          <Badge tone="warn">Modo demo</Badge>
        )}
      </CardHeader>

      <div className="border-b border-[var(--line)] px-5 py-4 last:border-0">
        <Label htmlFor="yt-key">API Key</Label>
        <Input
          id="yt-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status?.hint ?? "AIza…"}
          className="font-mono text-[12.5px]"
        />
        <FieldHint>
          {status?.source === "entorno"
            ? "Ahora mismo se usa la clave de YOUTUBE_API_KEY; el entorno tiene prioridad sobre lo que guardes aquí."
            : "Google Cloud → APIs y servicios → Biblioteca → activa «YouTube Data API v3» → Credenciales → Crear clave de API."}
        </FieldHint>
      </div>

      <div className="border-b border-[var(--line)] px-5 py-4 last:border-0">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          Sin clave, buscar un canal o un video devuelve datos de ejemplo marcados como
          «Modo demo». Con clave, se leen las cifras públicas reales: vistas, likes,
          comentarios, duración y fecha.
        </p>
      </div>

      {message && (
        <div className="border-b border-[var(--line)] px-5 py-3 last:border-0">
          <p
            className={`flex items-start gap-2 text-[12.5px] ${
              message.tone === "ok" ? "text-[var(--ok)]" : "text-[var(--danger)]"
            }`}
          >
            {message.tone === "ok" ? (
              <CircleCheck size={14} className="mt-px shrink-0" />
            ) : (
              <TriangleAlert size={14} className="mt-px shrink-0" />
            )}
            {message.text}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 px-5 py-4">
        <Button variant="secondary" onClick={test} disabled={testing || !status?.configured}>
          {testing && <LoaderCircle size={14} className="animate-spin" />}
          Probar conexión
        </Button>
        <Button variant="primary" onClick={save} disabled={saving || !key.trim()}>
          {saving && <LoaderCircle size={14} className="animate-spin" />}
          Guardar
        </Button>
      </div>
    </Card>
  );
}
