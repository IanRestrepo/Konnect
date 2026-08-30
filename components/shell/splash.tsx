"use client";

import { useEffect, useState } from "react";
import { KonnectMark } from "@/components/brand/logo";

/**
 * Animación de arranque.
 *
 * Se muestra una sola vez por pestaña, no en cada navegación: una marca que
 * aparece cada vez que cambias de página deja de ser bienvenida y pasa a ser
 * un estorbo.
 *
 * Tampoco bloquea nada. La aplicación ya está montada debajo; esto es una capa
 * que se desvanece encima, así que si algo fallara al animar, la pantalla
 * seguiría siendo usable.
 */

const CLAVE = "konnect.splash";
const DURACION = 1100;

function marcarVisto() {
  try {
    sessionStorage.setItem(CLAVE, "1");
  } catch {
    // Sin almacenamiento se volverá a ver; es preferible a no mostrarlo nunca.
  }
}

export function Splash() {
  // Arranca oculto y se decide en el efecto: en el servidor no hay
  // sessionStorage, y pintarlo por defecto haría que parpadeara para quien ya
  // lo vio.
  const [estado, setEstado] = useState<"oculto" | "visible" | "saliendo">("oculto");

  useEffect(() => {
    let visto = false;
    try {
      visto = sessionStorage.getItem(CLAVE) === "1";
    } catch {
      // Sin almacenamiento —modo privado, por ejemplo— se muestra igual.
    }
    if (visto) return;

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Quien pidió menos movimiento no ve nada: no es decorativo negociable.
    if (reducido) {
      marcarVisto();
      return;
    }

    // Decidir aquí es lo correcto: `sessionStorage` no existe en el servidor,
    // así que no se puede resolver durante el render sin romper la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("visible");
    const salida = setTimeout(() => setEstado("saliendo"), DURACION);
    const fin = setTimeout(() => {
      setEstado("oculto");
      /**
       * Se marca al terminar, no al empezar.
       *
       * En desarrollo React monta, limpia y vuelve a montar. Marcándolo al
       * principio, el segundo montaje veía «ya visto», salía sin programar los
       * temporizadores, y la capa se quedaba fija a pantalla completa tapando
       * la aplicación.
       */
      marcarVisto();
    }, DURACION + 420);

    return () => {
      clearTimeout(salida);
      clearTimeout(fin);
    };
  }, []);

  if (estado === "oculto") return null;

  return (
    <div
      className={`splash ${estado === "saliendo" ? "is-saliendo" : ""}`}
      aria-hidden
      // Decorativo: no debe robar el foco ni interceptar clics al desvanecerse.
      inert={estado === "saliendo"}
    >
      <div className="splash__marca">
        <KonnectMark className="h-12 w-auto" />
      </div>
      <span className="splash__linea" />
    </div>
  );
}
