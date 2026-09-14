import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addDeliverableKind, listDeliverableKinds, setDeliverableKinds } from "@/lib/store";

export const dynamic = "force-dynamic";

const BASES = ["video", "short", "integracion", "directo", "post"] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  return NextResponse.json({ kinds: await listDeliverableKinds() });
}

/**
 * Añade un tipo de pieza suelto.
 *
 * Pide `editar_campanas` y no `gestionar_ajustes` a propósito, igual que las
 * categorías de creador: se llama desde el diálogo de contratar, y quien puede
 * pactar una pieza tiene que poder nombrarla sin ir a pedirle permiso a nadie.
 * Reordenar y borrar el catálogo sigue siendo cosa de Configuración.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json(
      { error: "Tu rol no permite crear tipos de pieza." },
      { status: 403 },
    );
  }

  const parsed = z
    .object({
      name: z.string().min(1, "Ponle nombre al tipo de pieza.").max(60, "Máximo 60 caracteres."),
      baseType: z.enum(BASES).default("video"),
    })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const kinds = await addDeliverableKind(parsed.data.name, parsed.data.baseType);

  revalidatePath("/campanas");
  revalidatePath("/configuracion");
  return NextResponse.json({ kinds }, { status: 201 });
}

/** Reemplaza el catálogo completo, en el orden recibido. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_ajustes")) {
    return NextResponse.json(
      { error: "Tu rol no permite tocar la configuración." },
      { status: 403 },
    );
  }

  const parsed = z
    .object({
      kinds: z
        .array(
          z.object({
            name: z.string().max(60, "Un tipo no puede pasar de 60 caracteres."),
            baseType: z.enum(BASES).default("video"),
          }),
        )
        // Aquí sí vale vacío: el catálogo de tipos propios nace vacío, y
        // dejarlo así es una decisión legítima —los cinco de fábrica siguen.
        .default([]),
    })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const kinds = await setDeliverableKinds(parsed.data.kinds);

  revalidatePath("/campanas");
  revalidatePath("/configuracion");
  return NextResponse.json({ kinds });
}
