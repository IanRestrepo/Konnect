"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import { useSession } from "@/components/session-provider";
import { Announcements } from "@/components/shell/announcements";
import type { Announcement } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rutas que ocupan todo el lienzo y gestionan su propio scroll (bandejas, tableros). */
const FULL_BLEED = ["/mensajes", "/chat"];

/**
 * Rutas sin marco de aplicación: se dibujan solas. El portal va aquí aunque
 * quien lo abra tenga sesión de agencia: es la vista de gente de fuera.
 */
const BARE = ["/entrar", "/portal"];

export function AppShell({
  children,
  announcements = [],
}: {
  children: React.ReactNode;
  announcements?: Announcement[];
}) {
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
          <div className="flex h-full flex-col">
            <Announcements items={announcements} />
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        ) : (
          <>
            <Announcements items={announcements} />
            <div className="page px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-8 md:pb-20">{children}</div>
          </>
        )}
      </main>

      <MobileDock />
    </div>
  );
}
