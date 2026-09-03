"use client";

import { useState } from "react";
import {
  Building,
  Palette,
  Plug,
  Shield,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppearancePanel } from "@/components/shell/appearance-panel";
import { YoutubePanel } from "@/app/configuracion/youtube-panel";
import { TeamPanel } from "@/app/configuracion/team-panel";
import { CategoriesPanel } from "@/app/configuracion/categories-panel";
import { PageTitle } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TabId =
  | "apariencia"
  | "usuarios"
  | "roles"
  | "seguridad"
  | "integraciones"
  | "catalogos"
  | "organizacion";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "apariencia", label: "Apariencia", icon: Palette },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "seguridad", label: "Seguridad", icon: ShieldCheck },
  { id: "integraciones", label: "Integraciones", icon: Plug },
  { id: "catalogos", label: "Catálogos", icon: Tags },
  { id: "organizacion", label: "Organización", icon: Building },
];

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-[var(--line)] px-5 py-4 last:border-0">{children}</div>;
}

export function SettingsView() {
  const [tab, setTab] = useState<TabId>("apariencia");

  return (
    <div className="space-y-7">
      <PageTitle title="Configuración" description="Apariencia, seguridad e integraciones." />
      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
      <nav className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-[var(--r-pill)] px-3 text-[13.5px] whitespace-nowrap transition",
                active
                  ? "bg-[var(--surface-3)] font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <Icon size={14} className={active ? "text-[var(--text)]" : "text-[var(--text-subtle)]"} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-6">
        {tab === "apariencia" && (
          <Card>
            <CardHeader>
              <CardTitle>Tema de la aplicación</CardTitle>
              <span className="eyebrow">Este dispositivo</span>
            </CardHeader>
            <div className="border-t border-[var(--line)] p-5">
              <AppearancePanel />
            </div>
          </Card>
        )}

        {tab === "seguridad" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Código de datos sensibles</CardTitle>
                <Badge tone="ok">Activo</Badge>
              </CardHeader>
              <Row>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="code-current">Código actual</Label>
                    <Input id="code-current" type="password" placeholder="••••••" />
                  </div>
                  <div>
                    <Label htmlFor="code-new">Código nuevo</Label>
                    <Input id="code-new" type="password" placeholder="6 dígitos" />
                  </div>
                </div>
              </Row>
              <Row>
                <Label htmlFor="code-ttl">Duración de la sesión desbloqueada</Label>
                <Select id="code-ttl" defaultValue="5" className="max-w-64">
                  <option value="1">1 minuto</option>
                  <option value="5">5 minutos</option>
                  <option value="15">15 minutos</option>
                  <option value="0">Solo una vez</option>
                </Select>
                <FieldHint>Al expirar, los datos vuelven a ocultarse automáticamente.</FieldHint>
              </Row>
              <div className="flex justify-end px-5 py-4">
                <Button variant="primary">Guardar código</Button>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registro de accesos</CardTitle>
              </CardHeader>
              <p className="px-5 py-4 text-[13px] text-[var(--text-muted)]">
                Cada revelación de datos bancarios queda auditada. El historial se activa al
                conectar la base de datos.
              </p>
            </Card>
          </>
        )}

        {tab === "usuarios" && <TeamPanel tab="usuarios" />}

        {tab === "roles" && <TeamPanel tab="roles" />}

        {tab === "integraciones" && <YoutubePanel />}

        {tab === "catalogos" && <CategoriesPanel />}

        {tab === "organizacion" && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de la agencia</CardTitle>
            </CardHeader>
            <Row>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="org-name">Nombre</Label>
                  <Input id="org-name" defaultValue="Konnect" />
                </div>
                <div>
                  <Label htmlFor="org-currency">Moneda base</Label>
                  <Select id="org-currency" defaultValue="USD">
                    <option>USD</option>
                    <option>MXN</option>
                    <option>COP</option>
                    <option>EUR</option>
                  </Select>
                </div>
              </div>
            </Row>
            <div className="flex justify-end px-5 py-4">
              <Button variant="primary">Guardar cambios</Button>
            </div>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
