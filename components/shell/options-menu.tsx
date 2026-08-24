"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Palette, RotateCw, Settings } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { AppearancePanel } from "@/components/shell/appearance-panel";
import { useCan, useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

type View = "root" | "apariencia";

function Item({
  icon: Icon,
  label,
  onClick,
  href,
  tone = "default",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
}) {
  const className = cn(
    "flex h-8 w-full items-center gap-2.5 rounded-[var(--r-control)] px-2 text-[12.5px] transition",
    tone === "danger"
      ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
      : "text-[var(--text)] hover:bg-[var(--surface-3)]",
  );
  const content = (
    <>
      <Icon size={14} className="shrink-0 text-[var(--text-subtle)]" />
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={className} onClick={onClick}>
      {content}
    </Link>
  ) : (
    <button className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export function OptionsMenu({
  trigger,
  side = "top",
  align = "start",
}: {
  trigger: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const [view, setView] = useState<View>("root");
  const router = useRouter();
  const session = useSession();
  const can = useCan();

  async function salir() {
    await fetch("/api/auth/salir", { method: "POST" });
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <Popover
      side={side}
      align={align}
      className="w-60"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="block" aria-label="Opciones">
          {trigger}
        </button>
      )}
    >
      {({ close }) =>
        view === "root" ? (
          <div>
            {session && (
              <div className="mb-1 border-b border-[var(--line)] px-2 pt-1.5 pb-2.5">
                <p className="truncate text-[12.5px] font-medium">{session.name}</p>
                <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                  {session.email} · {session.roleName}
                </p>
              </div>
            )}
            {can("gestionar_ajustes") && (
              <Item icon={Settings} label="Configuración" href="/configuracion" onClick={close} />
            )}
            <Item icon={RotateCw} label="Recargar app" onClick={() => location.reload()} />
            <Item icon={Palette} label="Apariencia" onClick={() => setView("apariencia")} />
            <div className="my-1 h-px bg-[var(--line)]" />
            <Item icon={LogOut} label="Cerrar sesión" tone="danger" onClick={salir} />
          </div>
        ) : (
          <div>
            <div className="mb-1 flex items-center gap-1.5 px-1 pt-1">
              <button
                onClick={() => setView("root")}
                className="rounded-[var(--r-control)] p-1 text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                aria-label="Volver"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="eyebrow">Apariencia</p>
            </div>
            <AppearancePanel compact />
          </div>
        )
      }
    </Popover>
  );
}
