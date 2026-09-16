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

/** Cuenta las navegaciones. Va una sola vez, en el layout. */
export function NavigationMemory() {
  const pathname = usePathname();
  useEffect(() => {
    visitas += 1;
  }, [pathname]);
  return null;
}

/**
 * «Volver» que lleva a donde estabas, no a una pantalla fija.
 *
 * Los enlaces de vuelta apuntaban siempre al listado de la sección: entrabas a
 * una sesión desde la campaña y «volver» te dejaba en Sesiones, y había que
 * buscar la campaña otra vez. Ahora, si llegaste navegando dentro de la
 * aplicación, retrocede en el historial. Si abriste la página directamente
 * —un enlace pegado, una recarga—, no hay adónde retroceder sin salir de
 * Konnect, y lleva a `fallbackHref`.
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
