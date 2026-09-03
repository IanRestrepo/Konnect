import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listCreatorCategories, setCreatorCategories } from "@/lib/store";

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
