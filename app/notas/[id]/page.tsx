import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getDoc, listFolders } from "@/lib/store";
import { getCampaigns, getCompanies, getCreators } from "@/lib/data";
import { NoteDetail } from "@/app/notas/[id]/note-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);
  return { title: `${doc?.title ?? "Nota"} — Konnect` };
}

export default async function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_notas");
  const { id } = await params;

  const doc = await getDoc(id);
  if (!doc) notFound();

  const [folders, campaigns, creators, companies] = await Promise.all([
    listFolders(),
    getCampaigns(),
    getCreators(),
    getCompanies(),
  ]);

  return (
    <NoteDetail
      doc={doc}
      folders={folders}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
      creators={creators.map((c) => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl }))}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
