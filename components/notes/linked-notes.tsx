import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listDocs } from "@/lib/store";

/**
 * Las notas vinculadas a una campaña, un creador o una empresa.
 *
 * Es un componente de servidor: consulta directamente, sin pasar por la API,
 * porque siempre se pinta dentro de una página que ya es de servidor.
 */
export async function LinkedNotes({
  campaignId,
  creatorId,
  companyId,
}: {
  campaignId?: string;
  creatorId?: string;
  companyId?: string;
}) {
  const docs = await listDocs({ campaignId, creatorId, companyId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
        <Link
          href="/notas"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <Plus size={13} />
          Nueva
        </Link>
      </CardHeader>

      {docs.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
          Sin notas vinculadas. Crea una en Notas y enlázala desde allí.
        </p>
      ) : (
        <ul className="px-2 pb-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/notas/${d.id}`}
                className="flex items-start gap-2.5 rounded-[var(--r-control)] px-3 py-2.5 transition hover:bg-[var(--surface-2)]"
              >
                <FileText size={15} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{d.title}</span>
                  {d.excerpt && (
                    <span className="line-clamp-2 text-[12px] text-[var(--text-subtle)]">
                      {d.excerpt}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
