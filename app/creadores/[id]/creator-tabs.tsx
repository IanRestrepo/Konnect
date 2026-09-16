"use client";

import { useState } from "react";
import { Segmented } from "@/components/shell/toolbar";

export type Pestana = {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
};

/**
 * Las secciones de la ficha del creador, de una en una.
 *
 * La ficha había crecido hasta once tarjetas en fila, y lo que se buscaba
 * —casi siempre sus campañas o sus tarifas— quedaba a tres pantallas de
 * scroll. Con pestañas cada sección cabe en una pantalla.
 *
 * Todas se renderizan en el servidor y aquí solo se esconden: cambiar de
 * pestaña es instantáneo y no pierde lo que se estuviera editando en otra.
 */
export function CreatorTabs({ pestanas }: { pestanas: Pestana[] }) {
  const [activa, setActiva] = useState(pestanas[0]?.id ?? "");

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <Segmented
          options={pestanas.map((p) => ({ id: p.id, label: p.label, count: p.count }))}
          value={activa}
          onChange={setActiva}
        />
      </div>
      {pestanas.map((p) => (
        <div key={p.id} hidden={p.id !== activa}>
          {p.content}
        </div>
      ))}
    </div>
  );
}
