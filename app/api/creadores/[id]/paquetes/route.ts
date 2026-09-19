import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { removeCreatorPackage, saveCreatorPackage } from "@/lib/store";
import { IMPORTE_MAXIMO } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Ponle un nombre al paquete.").max(120),
  price: z
    .number({ error: "Falta el precio del paquete." })
    .positive("El precio del paquete tiene que ser mayor que cero.")
    .max(IMPORTE_MAXIMO, "Ese precio es demasiado grande para guardarlo."),
  items: z
    .array(
      z.object({
        platform: z.enum(["youtube", "instagram", "tiktok", "x", "twitch", "kick", "discord", "roblox", "web"]),
        type: z.enum(["video", "short", "integracion", "directo", "post"]),
        customType: z.string().trim().max(80).nullable().default(null),
        qty: z.number().int().min(1, "Cada línea necesita al menos una pieza.").max(100),
      }),
    )
    .min(1, "El paquete necesita al menos una pieza.")
    .max(30),
  notes: z.string().trim().max(1000).default(""),
});

async function permitido() {
  const session = await getSession();
  return session && hasPermission(session.permissions, "editar_creadores");
}

/** Crea un paquete, o lo reemplaza entero si trae id. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await permitido())) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const pkg = await saveCreatorPackage(id, {
    ...parsed.data,
    items: parsed.data.items.map((i) => ({ ...i, customType: i.customType || null })),
  });
  if (!pkg) return NextResponse.json({ error: "Ese paquete no existe." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ package: pkg });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await permitido())) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  const { id } = await params;
  const packageId = new URL(request.url).searchParams.get("packageId") ?? "";

  if (!(await removeCreatorPackage(id, packageId))) {
    return NextResponse.json({ error: "Ese paquete no existe." }, { status: 404 });
  }
  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ ok: true });
}
