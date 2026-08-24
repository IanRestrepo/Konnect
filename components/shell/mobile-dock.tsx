"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useCan } from "@/components/session-provider";
import { OptionsMenu } from "@/components/shell/options-menu";
import { cn } from "@/lib/utils";

/**
 * Menú flotante para teléfono: pastilla fija sobre el borde inferior, dentro
 * del área segura del dispositivo. Sustituye al riel lateral por debajo de md.
 */
export function MobileDock() {
  const pathname = usePathname();
  const can = useCan();
  const items = NAV_ITEMS.filter((item) => can(item.permission));
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Navegación principal"
    >
      <div className="flex items-center gap-0.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-1.5 shadow-[var(--shadow-pop)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-[var(--r-pill)] transition",
                active
                  ? "bg-[var(--solid)] text-[var(--solid-fg)]"
                  : "text-[var(--text-subtle)] active:bg-[var(--surface-2)]",
              )}
            >
              <Icon size={19} strokeWidth={1.75} />
            </Link>
          );
        })}

        <span className="mx-0.5 h-6 w-px bg-[var(--line)]" />

        <OptionsMenu
          side="top"
          align="end"
          trigger={
            <span className="grid h-11 w-11 place-items-center rounded-[var(--r-pill)] text-[var(--text-subtle)] active:bg-[var(--surface-2)]">
              <span className="text-[18px] leading-none">···</span>
            </span>
          }
        />
      </div>
    </nav>
  );
}
