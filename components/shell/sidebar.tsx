"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useCan } from "@/components/session-provider";
import { OptionsMenu } from "@/components/shell/options-menu";
import { KonnectMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Riel de iconos: 64px, botones de 40px redondeados, activo en sólido. */
export function Sidebar() {
  const pathname = usePathname();
  const can = useCan();
  const items = NAV_ITEMS.filter((item) => can(item.permission));
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="z-20 flex w-16 shrink-0 flex-col items-center py-4">
      <Link
        href="/"
        aria-label="Konnect"
        className="mb-5 grid h-10 w-10 place-items-center rounded-[var(--r-control)] text-[var(--brand)] transition hover:bg-[var(--surface)]"
      >
        <KonnectMark size={19} />
      </Link>

      <nav className="flex flex-col items-center gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Tooltip key={item.href} label={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-[var(--r-control)] border transition",
                  active
                    ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                    : "border-transparent text-[var(--text-subtle)] hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
                )}
              >
                <Icon size={18} strokeWidth={1.75} />
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 pt-5">
        <OptionsMenu
          trigger={
            <Tooltip label="Opciones">
              <span className="grid h-10 w-10 place-items-center rounded-[var(--r-control)] border border-transparent text-[var(--text-subtle)] transition hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
                <span className="text-[17px] leading-none">···</span>
              </span>
            </Tooltip>
          }
        />
        <Avatar name="Admin Konnect" size={32} />
      </div>
    </aside>
  );
}
