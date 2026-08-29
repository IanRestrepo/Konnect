import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { isDeveloper, normalizeModules } from "@/lib/permissions";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  setDisabledModules,
  getDisabledModules,
  updateAnnouncement,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const aviso = z.object({
  accion: z.literal("aviso"),
  id: z.string().optional(),
  message: z.string().min(1, "Escribe el mensaje.").max(300),
  tone: z.enum(["info", "ok", "warn", "danger"]).default("info"),
  active: z.boolean().default(true),
  roleIds: z.array(z.string()).default([]),
  dismissible: z.boolean().default(true),
});

const borrarAviso = z.object({ accion: z.literal("borrar_aviso"), id: z.string().min(1) });

// Lo que llega es la lista entera de módulos apagados, no un cambio suelto: se
// limpia en vez de rechazarse, porque una llave que ya no existe dejaría al
// desarrollador sin poder encender ni apagar nada.
const modulos = z.object({
  accion: z.literal("modulos"),
  disabled: z.array(z.string()).default([]),
});

const schema = z.discriminatedUnion("accion", [aviso, borrarAviso, modulos]);

/** Todo lo del desarrollador entra por aquí, y solo él pasa. */
async function soloDesarrollador() {
  const session = await getSession();
  if (!session || !isDeveloper(session.permissions)) return null;
  return session;
}

export async function GET() {
  if (!(await soloDesarrollador())) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const [announcements, disabled] = await Promise.all([
    listAnnouncements(),
    getDisabledModules(),
  ]);
  return NextResponse.json({ announcements, disabled });
}

export async function POST(request: Request) {
  if (!(await soloDesarrollador())) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const datos = parsed.data;

  if (datos.accion === "modulos") {
    const disabled = await setDisabledModules(normalizeModules(datos.disabled));
    revalidatePath("/", "layout");
    return NextResponse.json({ disabled });
  }

  if (datos.accion === "borrar_aviso") {
    if (!(await deleteAnnouncement(datos.id))) {
      return NextResponse.json({ error: "Aviso no encontrado." }, { status: 404 });
    }
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  }

  const { id, message, tone, active, roleIds, dismissible } = datos;
  const campos = { message, tone, active, roleIds, dismissible };
  const announcement = id
    ? await updateAnnouncement(id, campos)
    : await createAnnouncement(campos);

  if (!announcement) {
    return NextResponse.json({ error: "Aviso no encontrado." }, { status: 404 });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ announcement }, { status: id ? 200 : 201 });
}
