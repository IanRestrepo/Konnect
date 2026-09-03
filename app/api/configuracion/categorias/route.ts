import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import {
  addCreatorCategory,
  listCreatorCategories,
  setCreatorCategories,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  categories: z
    .array(z.string().max(60, "Una categoría no puede pasar de 60 caracteres."))
    // Vacío no vale: si el catálogo se queda sin nada, la tabla vacía volvería
    // a significar «sin estrenar» y se resembraría sola con las de fábrica.
    .min(1, "Deja al menos una categoría."),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  return NextResponse.json({ categories: await listCreatorCategories() });
}

/**
 * Añade una categoría suelta.
 *
 * Pide `editar_creadores` y no `gestionar_ajustes` a propósito: se llama desde
 * la ficha del creador, y quien puede dar de alta a un creador tiene que poder
 * clasificarlo sin ir a pedirle permiso a nadie. Reordenar y borrar el
 * catálogo sigue siendo cosa de Configuración.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite crear categorías." }, { status: 403 });
  }

  const parsed = z
    .object({ name: z.string().min(1, "Ponle nombre a la categoría.").max(60, "Máximo 60 caracteres.") })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const categories = await addCreatorCategory(parsed.data.name);

  revalidatePath("/creadores");
  revalidatePath("/configuracion");
  return NextResponse.json({ categories }, { status: 201 });
}

/** Reemplaza el catálogo completo, en el orden recibido. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_ajustes")) {
    return NextResponse.json({ error: "Tu rol no permite tocar la configuración." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const categories = await setCreatorCategories(parsed.data.categories);
  if (categories.length === 0) {
    return NextResponse.json({ error: "Deja al menos una categoría con nombre." }, { status: 400 });
  }

  revalidatePath("/creadores");
  revalidatePath("/configuracion");
  return NextResponse.json({ categories });
}
