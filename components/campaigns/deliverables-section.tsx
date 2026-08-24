"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Film, Plus, RefreshCw } from "lucide-react";
import { SectionLabel } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListBox, ListRow } from "@/components/ui/list";
import { AddDeliverableDialog } from "@/components/campaigns/add-deliverable-dialog";
import { DELIVERABLE_STATUS, DELIVERABLE_TYPE } from "@/lib/labels";
import type { Creator, Currency, Deliverable } from "@/lib/types";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export function DeliverablesSection({
  campaignId,
  deliverables,
  creators,
  currency,
}: {
  campaignId: string;
  deliverables: Deliverable[];
  creators: Creator[];
  currency: Currency;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <SectionLabel className="mb-0">Entregables</SectionLabel>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm">
            <RefreshCw size={14} />
            Actualizar
          </Button>
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            <Plus size={15} />
            Añadir
          </Button>
        </div>
      </div>

      {deliverables.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Sin entregables"
          description="Añade el primer video pegando su enlace de YouTube."
          action={
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} />
              Añadir entregable
            </Button>
          }
        />
      ) : (
        <ListBox>
          {deliverables.map((d) => {
            const creator = creators.find((c) => c.id === d.creatorId);
            const status = DELIVERABLE_STATUS[d.status];
            return (
              <ListRow
                key={d.id}
                chevron={false}
                leading={
                  d.thumbnail ? (
                    <img
                      src={d.thumbnail}
                      alt=""
                      className="h-[38px] w-[66px] shrink-0 rounded-[var(--r-control)] object-cover"
                    />
                  ) : (
                    <span className="grid h-[38px] w-[66px] shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--surface-3)] text-[var(--text-subtle)]">
                      <Film size={16} strokeWidth={1.75} />
                    </span>
                  )
                }
                title={d.title ?? "Pendiente de publicar"}
                subtitle={
                  <>
                    {creator && (
                      <span className="mr-1.5 inline-flex items-center gap-1.5 align-middle">
                        <Avatar src={creator.avatarUrl} name={creator.name} size={16} />
                        {creator.name}
                      </span>
                    )}
                    · {DELIVERABLE_TYPE[d.type]} ·{" "}
                    {d.publishedAt ? formatDate(d.publishedAt) : "sin fecha"}
                  </>
                }
                trailing={
                  <span className="flex items-center gap-4">
                    <span className="hidden text-right sm:block">
                      <span className="tabular block text-[14px] font-semibold">
                        {d.views ? formatCompact(d.views) : "—"}
                      </span>
                      <span className="block text-[11.5px] text-[var(--text-subtle)]">
                        {formatMoney(d.agreedFee, currency)}
                      </span>
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {d.videoUrl && (
                      <Link
                        href={d.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[var(--text-subtle)] transition hover:text-[var(--accent)]"
                        aria-label="Abrir en YouTube"
                      >
                        <ExternalLink size={15} />
                      </Link>
                    )}
                  </span>
                }
              />
            );
          })}
        </ListBox>
      )}

      <AddDeliverableDialog
        open={open}
        onClose={() => setOpen(false)}
        campaignId={campaignId}
        creators={creators}
      />
    </section>
  );
}
