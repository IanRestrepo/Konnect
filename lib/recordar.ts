"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Estado de pantalla que sobrevive a ir y volver: la pestaña, la búsqueda y la
 * página de una lista.
 *
 * Con `useState` la lista se montaba de cero al volver de una ficha, y
 * «Volver» parecía llevar a «todas las campañas» aunque estuvieras filtrando
 * las de un cliente en la página tres. Se guarda en `sessionStorage`, que es
 * por pestaña y se va al cerrarla: recordar un filtro de ayer sorprendería más
 * que ayudar.
 *
 * El mapa en memoria va delante del almacenamiento porque este puede fallar
 * —modo privado, cuota— y entonces la lista tiene que seguir funcionando,
 * aunque no recuerde nada.
 */

const PREFIJO = "konnect.vista.";
const memoria = new Map<string, string | null>();
const oyentes = new Set<() => void>();

function leer(clave: string): string | null {
  if (!memoria.has(clave)) {
    let guardado: string | null = null;
    try {
      guardado = sessionStorage.getItem(PREFIJO + clave);
    } catch {
      // Sin almacenamiento: se queda en memoria.
    }
    memoria.set(clave, guardado);
  }
  return memoria.get(clave) ?? null;
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function useRecordado<T>(clave: string, inicial: T) {
  // En el servidor no hay nada guardado: se pinta el valor inicial y, al
  // hidratar, React vuelve a pintar con lo recordado.
  const bruto = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    () => null,
  );

  let valor = inicial;
  if (bruto != null) {
    try {
      valor = JSON.parse(bruto) as T;
    } catch {
      // Algo corrupto en el almacenamiento: mejor el valor inicial.
    }
  }

  const poner = useCallback(
    (siguiente: T) => {
      const texto = JSON.stringify(siguiente);
      memoria.set(clave, texto);
      try {
        sessionStorage.setItem(PREFIJO + clave, texto);
      } catch {
        // Queda en memoria mientras dure la pestaña.
      }
      oyentes.forEach((o) => o());
    },
    [clave],
  );

  return [valor, poner] as const;
}
