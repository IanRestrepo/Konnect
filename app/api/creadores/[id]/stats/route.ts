import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addCreatorStatShot, removeCreatorStatShot } from "@/lib/store";
import { MAXIMO_CAPTURA, TIPOS_IMAGEN, esFallo, subirArchivo } from "@/lib/uploads";
import { PLATFORMS } from "@/lib/socials";
import type { SocialPlatform } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Capturas de las estadísticas del creador.
 *
 * Es el plan B cuando no cede acceso a su API: se le piden pantallazos de su
 * panel y se guardan aquí, fechados, junto a su ficha.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const platform = String(form.get("platform") ?? "");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300);
  const fecha = String(form.get("takenAt") ?? "");
  const takenAt = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00`).toISOString() : null;

  const subido = await subirArchivo(form.get("archivo"), {
    carpeta: `stats/${id}`,
    tipos: TIPOS_IMAGEN,
    maximo: MAXIMO_CAPTURA,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  const shot = await addCreatorStatShot(id, {
    url: subido.url,
    fileName: subido.fileName,
    platform: PLATFORMS.some((p) => p.id === platform) ? (platform as SocialPlatform) : null,
    caption,
    takenAt,
    uploadedBy: session.name,
  });
  if (!shot) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ shot }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  const { id } = await params;
  const shotId = new URL(request.url).searchParams.get("shotId") ?? "";

  const url = await removeCreatorStatShot(id, shotId);
  if (!url) return NextResponse.json({ error: "Esa captura no existe." }, { status: 404 });

  // Si el archivo no se puede borrar, la ficha ya no lo enseña; no es motivo
  // para dar error a quien lo quitó.
  await del(url).catch(() => undefined);

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ ok: true });
}
