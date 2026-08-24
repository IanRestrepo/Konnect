"use client";

import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ListBox, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { NewCreatorDialog } from "@/components/creators/new-creator-dialog";
import { CREATOR_STATUS } from "@/lib/labels";
import type { Creator, CreatorStatus } from "@/lib/types";
import { formatCompact, formatMoney } from "@/lib/utils";

type Filter = CreatorStatus | "todos";

export function CreatorsView({
  creators,
  campaignCount,
}: {
  creators: Creator[];
  campaignCount: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filters = useMemo<{ id: Filter; label: string; count: number }[]>(
    () => [
      { id: "todos", label: "Todos", count: creators.length },
      { id: "activo", label: "Activos", count: creators.filter((c) => c.status === "activo").length },
      {
        id: "pausado",
        label: "En pausa",
        count: creators.filter((c) => c.status === "pausado").length,
      },
      {
        id: "prospecto",
        label: "Prospectos",
        count: creators.filter((c) => c.status === "prospecto").length,
      },
    ],
    [creators],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return creators.filter((c) => {
      if (status !== "todos" && c.status !== status) return false;
      if (!q) return true;
      return [c.name, c.handle, c.category, c.email, c.country].join(" ").toLowerCase().includes(q);
    });
  }, [creators, query, status]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Creator[]>();
    filtered.forEach((creator) => {
      const list = groups.get(creator.category) ?? [];
      list.push(creator);
      groups.set(creator.category, list);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Creadores"
        description="Todo canal con el que trabajamos vive aquí."
        actions={
          <Button variant="accent" size="icon-lg" onClick={() => setDialogOpen(true)} aria-label="Añadir creador">
            <Plus size={20} strokeWidth={2.25} />
          </Button>
        }
      />

      <Toolbar>
        <Segmented options={filters} value={status} onChange={setStatus} />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar nombre, canal o correo"
          className="ml-auto"
        />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description="Ajusta los filtros o añade un creador pegando el enlace de su canal."
          action={
            <Button variant="accent" onClick={() => setDialogOpen(true)}>
              <Plus size={16} />
              Añadir creador
            </Button>
          }
        />
      ) : (
        byCategory.map(([category, list]) => (
          <section key={category}>
            <SectionLabel>{category}</SectionLabel>
            <ListBox>
              {list.map((creator) => {
                const status = CREATOR_STATUS[creator.status];
                return (
                  <ListRow
                    key={creator.id}
                    href={`/creadores/${creator.id}`}
                    leading={<Avatar src={creator.avatarUrl} name={creator.name} size={38} />}
                    title={creator.name}
                    subtitle={`${creator.handle} · ${formatCompact(creator.subscribers)} subs · ${campaignCount[creator.id] ?? 0} campañas`}
                    trailing={
                      <span className="flex items-center gap-4">
                        <span className="hidden text-right sm:block">
                          <span className="tabular block text-[14px] font-semibold">
                            {formatMoney(creator.rateVideo, creator.currency)}
                          </span>
                          <span className="block text-[11.5px] text-[var(--text-subtle)]">
                            por video
                          </span>
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                    }
                  />
                );
              })}
            </ListBox>
          </section>
        ))
      )}

      <NewCreatorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
