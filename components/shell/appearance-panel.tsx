"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { ACCENTS, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-1.5">{title}</p>
      {children}
    </section>
  );
}

export function AppearancePanel({ compact = false }: { compact?: boolean }) {
  const { prefs, setPrefs } = usePreferences();

  return (
    <div className={cn("space-y-4", compact && "px-1 pb-1")}>
      <Section title="Modo">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--line)]">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = prefs.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setPrefs({ mode: m.id })}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 text-[12.5px] transition",
                  active
                    ? "bg-[var(--surface-3)] font-medium text-[var(--text)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Icon size={13} />
                {m.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Color de acento">
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => {
            const active = prefs.accent === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setPrefs({ accent: a.id })}
                title={a.label}
                aria-label={a.label}
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full transition",
                  active
                    ? "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]"
                    : "hover:scale-110",
                )}
                style={{ background: a.swatch }}
              >
                {active && <Check size={12} strokeWidth={3} className="text-white mix-blend-difference" />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Densidad">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--line)]">
          {(["comoda", "compacta"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setPrefs({ density: d })}
              className={cn(
                "h-8 text-[12.5px] transition",
                prefs.density === d
                  ? "bg-[var(--surface-3)] font-medium text-[var(--text)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {d === "comoda" ? "Cómoda" : "Compacta"}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
