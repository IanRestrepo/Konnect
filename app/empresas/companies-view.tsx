"use client";

import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ListBox, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { NewCompanyDialog } from "@/components/companies/new-company-dialog";
import { COMPANY_STATUS } from "@/lib/labels";
import type { Company } from "@/lib/types";
import { formatCompact, formatMoney } from "@/lib/utils";

type Stats = Record<string, { campaigns: number; invested: number; views: number }>;
type Filter = "todas" | "activo" | "prospecto" | "inactivo";

export function CompaniesView({ companies, stats }: { companies: Company[]; stats: Stats }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [open, setOpen] = useState(false);

  const filters = useMemo<{ id: Filter; label: string; count: number }[]>(
    () => [
      { id: "todas", label: "Todas", count: companies.length },
      {
        id: "activo",
        label: "Activas",
        count: companies.filter((c) => c.status === "activo").length,
      },
      {
        id: "prospecto",
        label: "Prospectos",
        count: companies.filter((c) => c.status === "prospecto").length,
      },
      {
        id: "inactivo",
        label: "Inactivas",
        count: companies.filter((c) => c.status === "inactivo").length,
      },
    ],
    [companies],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (filter !== "todas" && c.status !== filter) return false;
      if (!q) return true;
      return `${c.name} ${c.industry} ${c.contactName} ${c.email}`.toLowerCase().includes(q);
    });
  }, [companies, query, filter]);

  const bySector = useMemo(() => {
    const groups = new Map<string, Company[]>();
    filtered.forEach((company) => {
      const list = groups.get(company.industry) ?? [];
      list.push(company);
      groups.set(company.industry, list);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Empresas"
        description="Toda marca que contrata una campaña es un cliente."
        actions={
          <Button variant="accent" size="icon-lg" onClick={() => setOpen(true)} aria-label="Añadir empresa">
            <Plus size={20} strokeWidth={2.25} />
          </Button>
        }
      />

      <Toolbar>
        <Segmented options={filters} value={filter} onChange={setFilter} />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar empresa o contacto"
          className="ml-auto"
        />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin empresas"
          description="Registra la marca que contrata para vincularla a sus campañas."
          action={
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} />
              Añadir empresa
            </Button>
          }
        />
      ) : (
        bySector.map(([sector, list]) => (
          <section key={sector}>
            <SectionLabel>{sector}</SectionLabel>
            <ListBox>
              {list.map((company) => {
                const status = COMPANY_STATUS[company.status];
                const s = stats[company.id];
                return (
                  <ListRow
                    key={company.id}
                    href={`/empresas/${company.id}`}
                    leading={<Avatar name={company.name} size={38} rounded="lg" />}
                    title={company.name}
                    subtitle={`${company.contactName} · ${s?.campaigns ?? 0} campañas · ${formatCompact(s?.views ?? 0)} vistas`}
                    trailing={
                      <span className="flex items-center gap-4">
                        <span className="tabular hidden text-[14px] font-semibold sm:block">
                          {formatMoney(s?.invested ?? 0)}
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

      <NewCompanyDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
