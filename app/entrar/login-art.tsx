/* eslint-disable @next/next/no-img-element */
import { KonnectMark } from "@/components/brand/logo";

/**
 * Panel derecho del acceso. Con foto en `public/brand/login.*` la usa; si no,
 * dibuja un lienzo de marca: el isotipo sobredimensionado y recortado sobre
 * el azul de Konnect. Nada de degradados de relleno.
 */
export function LoginArt({ src }: { src: string | null }) {
  return (
    <div className="relative hidden p-3 pl-0 lg:block">
      <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-[#0046d9]">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            {/* Isotipo recortado: ocupa el lienzo sin convertirse en un patrón. */}
            <span
              className="pointer-events-none absolute -right-[12%] -bottom-[18%] text-white/[0.09]"
              aria-hidden
            >
              <KonnectMark size={620} />
            </span>
            <span
              className="pointer-events-none absolute -top-[14%] -left-[8%] text-white/[0.06]"
              aria-hidden
            >
              <KonnectMark size={360} />
            </span>
          </>
        )}

        {/* Velo inferior para que el texto se lea sobre cualquier foto. */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute bottom-8 left-8 max-w-sm">
          <p className="text-[17px] font-semibold tracking-[-0.02em] text-white">Konnect</p>
          <p className="mt-1 text-[13.5px] text-white/70">
            Creadores, campañas y clientes de la agencia en un solo sitio.
          </p>
        </div>
      </div>
    </div>
  );
}
