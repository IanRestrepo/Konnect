"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

/** Rutas que ocupan todo el lienzo y gestionan su propio scroll (bandejas, tableros). */
const FULL_BLEED = ["/mensajes"];

/** Rutas sin marco de aplicación: se dibujan solas. */
const BARE = ["/entrar"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const session = useSession();

  const bare = BARE.some((route) => pathname.startsWith(route)) || !session;
  if (bare) return <>{children}</>;

  const fullBleed = FULL_BLEED.some((route) => pathname.startsWith(route));

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--canvas)]">
      {/* Riel lateral desde tablet; en teléfono manda el menú flotante. */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <main
        className={cn(
          "m-2 min-w-0 flex-1 rounded-[var(--r-panel)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] md:my-3 md:mr-3 md:ml-0",
          fullBleed ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {fullBleed ? (
          children
        ) : (
          <div className="page px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-8 md:pb-20">{children}</div>
        )}
      </main>

      <MobileDock />
    </div>
  );
}
