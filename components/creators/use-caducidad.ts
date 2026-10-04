"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cuenta atrás para lo que se revela un rato y luego se vuelve a tapar.
 *
 * Guarda la hora a la que caduca, no los segundos que quedan. Antes había un
 * contador que restaba de uno en uno y, aparte, un temporizador para tapar;
 * los dos se desincronizaban: al guardar un cambio el temporizador volvía a
 * empezar y el contador no, así que marcaba «00:00» con los datos todavía a la
 * vista. Con una sola hora de caducidad, lo que se pinta y lo que se tapa
 * salen del mismo sitio.
 *
 * También se mira al volver a la pestaña: el navegador frena los intervalos
 * de las pestañas en segundo plano, y sin eso los datos seguían visibles al
 * volver aunque ya hubieran pasado los cinco minutos.
 */
export function useCaducidad(duracionMs: number, alCaducar: () => void) {
  const [hasta, setHasta] = useState<number | null>(null);
  const [restan, setRestan] = useState(0);

  // Siempre la última versión de lo que hay que hacer al caducar, sin que
  // cambiarla reinicie la cuenta.
  const fin = useRef(alCaducar);
  useEffect(() => {
    fin.current = alCaducar;
  });

  useEffect(() => {
    if (hasta === null) return;
    const mirar = () => {
      const quedan = hasta - Date.now();
      if (quedan <= 0) {
        setHasta(null);
        setRestan(0);
        fin.current();
      } else {
        setRestan(Math.ceil(quedan / 1000));
      }
    };
    const tic = setInterval(mirar, 1000);
    document.addEventListener("visibilitychange", mirar);
    window.addEventListener("focus", mirar);
    return () => {
      clearInterval(tic);
      document.removeEventListener("visibilitychange", mirar);
      window.removeEventListener("focus", mirar);
    };
  }, [hasta]);

  const empezar = useCallback(() => {
    setHasta(Date.now() + duracionMs);
    setRestan(Math.ceil(duracionMs / 1000));
  }, [duracionMs]);

  const parar = useCallback(() => {
    setHasta(null);
    setRestan(0);
  }, []);

  const mmss = `${String(Math.floor(restan / 60)).padStart(2, "0")}:${String(restan % 60).padStart(2, "0")}`;

  return { empezar, parar, mmss };
}
