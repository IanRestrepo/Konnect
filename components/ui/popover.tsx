"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "start",
  side = "right",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const position = {
    top: "bottom-full mb-1.5",
    bottom: "top-full mt-1.5",
    right: "left-full ml-1.5 top-0",
    left: "right-full mr-1.5 top-0",
  }[side];

  const alignment =
    side === "top" || side === "bottom"
      ? { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" }[align]
      : { start: "top-0", center: "top-1/2 -translate-y-1/2", end: "bottom-0 top-auto" }[align];

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            "animate-layer absolute z-50 min-w-56 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]",
            position,
            alignment,
            className,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
