"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cuántas páginas se han visitado en esta pestaña sin recargar.
 *
 * Vive en el módulo y no en estado: no pinta nada, solo decide adónde lleva
 * «Volver». Se reinicia con una recarga, que es justo cuando el historial del
 * navegador puede apuntar fuera de la aplicación.
 */
let visitas = 0;

/** La navegación en curso vino del botón atrás (o de «Volver»). */
let volviendo = false;

const CLAVE_SCROLL = "konnect.scroll.";

function urlActual() {
  return location.pathname + location.search;
}

function guardarScroll(url: string, top: number) {
  try {
    sessionStorage.setItem(CLAVE_SCROLL + url, String(Math.round(top)));
  } catch {
    // Sin almacenamiento no se recuerda la posición; lo demás sigue igual.
  }
}

function leerScroll(url: string): number | null {
  try {
    const v = sessionStorage.getItem(CLAVE_SCROLL + url);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

/**
 * Cuenta las navegaciones y recuerda por dónde ibas en cada página. Va una
 * sola vez, en el layout.
 *
 * El navegador sabe devolver el scroll al volver, pero aquí no le sirve: lo
 * que se desplaza no es la ventana sino el panel `<main>` de la aplicación, y
 * ese panel es el mismo en todas las páginas. Al volver de una ficha quedabas
 * arriba de la lista, o a la altura a la que ibas en la ficha, y había que
 * buscar otra vez la fila de la que saliste.
 */
export function NavigationMemory() {
  const pathname = usePathname();

  useEffect(() => {
    const alVolver = () => {
      volviendo = true;
    };
    // Se guarda al pulsar, antes de que empiece la navegación: el scroll que
    // hace Next al llegar a la página nueva ya no debe contar como de esta.
    const alPulsar = () => {
      const main = document.querySelector<HTMLElement>("[data-scroll-principal]");
      if (main) guardarScroll(urlActual(), main.scrollTop);
    };
    window.addEventListener("popstate", alVolver);
    document.addEventListener("pointerdown", alPulsar, true);
    return () => {
      window.removeEventListener("popstate", alVolver);
      document.removeEventListener("pointerdown", alPulsar, true);
    };
  }, []);

  useEffect(() => {
    visitas += 1;
    const main = document.querySelector<HTMLElement>("[data-scroll-principal]");
    if (!main) return;
    const url = urlActual();

    let espera: number | undefined;
    const alDesplazar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        // Si ya cambió la dirección, este scroll es de la página siguiente.
        if (urlActual() === url) guardarScroll(url, main.scrollTop);
      }, 150);
    };
    main.addEventListener("scroll", alDesplazar, { passive: true });

    let cuadro: number | undefined;
    let soltar: (() => void) | undefined;
    if (volviendo) {
      volviendo = false;
      const destino = leerScroll(url);
      if (destino != null) {
        // La lista puede tardar un poco en tener su altura —se restaura el
        // filtro, llegan los datos—, así que se insiste durante un momento. Si
        // quien usa la app se mueve antes, manda él.
        const hasta = performance.now() + 1200;
        const rendirse = () => {
          if (cuadro) cancelAnimationFrame(cuadro);
          cuadro = undefined;
        };
        main.addEventListener("wheel", rendirse, { once: true, passive: true });
        main.addEventListener("touchstart", rendirse, { once: true, passive: true });
        soltar = () => {
          main.removeEventListener("wheel", rendirse);
          main.removeEventListener("touchstart", rendirse);
        };
        const paso = () => {
          main.scrollTop = destino;
          if (Math.abs(main.scrollTop - destino) > 2 && performance.now() < hasta) {
            cuadro = requestAnimationFrame(paso);
          } else {
            cuadro = undefined;
          }
        };
        paso();
      } else {
        main.scrollTop = 0;
      }
    }

    return () => {
      window.clearTimeout(espera);
      if (cuadro) cancelAnimationFrame(cuadro);
      soltar?.();
      main.removeEventListener("scroll", alDesplazar);
    };
  }, [pathname]);

  return null;
}

/**
 * «Volver» que lleva a donde estabas, no a una pantalla fija.
 *
 * Los enlaces de vuelta apuntaban siempre al listado de la sección: entrabas a
 * una sesión desde la campaña y «volver» te dejaba en Sesiones, y había que
 * buscar la campaña otra vez. Ahora, si llegaste navegando dentro de la
 * aplicación, retrocede en el historial —y la lista recupera su pestaña, su
 * búsqueda, su página y su scroll—. Si abriste la página directamente —un
 * enlace pegado, una recarga—, no hay adónde retroceder sin salir de Konnect,
 * y lleva a `fallbackHref`.
 */
export function BackLink({
  fallbackHref,
  className,
}: {
  /** Adónde ir si no hay página anterior dentro de la aplicación. */
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        // Más de una visita: la actual y al menos una anterior en la app.
        if (visitas > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]",
        className,
      )}
    >
      <ArrowLeft size={15} />
      Volver
    </Link>
  );
}
