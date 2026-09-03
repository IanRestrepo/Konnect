import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCreatorRates } from "@/lib/store";
import { IMPORTE_MAXIMO } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const schema = z.object({
  rates: z.array(
    z.object({
      platform: z.enum([
        "youtube",
        "instagram",
        "tiktok",
        "x",
        "twitch",
        "kick",
        "discord",
        "roblox",
        "web",
      ]),
      type: z.enum(["video", "short", "integracion", "directo", "post"]),
      amount: z
        .number()
        .min(0, "Una tarifa no puede ser negativa.")
        .max(IMPORTE_MAXIMO, "Ese importe no cabe en la base.")
        .default(0),
      /** Canal secundario al que aplica. Vacío = toda la red. */
      channelId: z.string().default(""),
    }),
  ),
});

/**
 * Reemplaza el tarifario del creador: su precio base por red y tipo de pieza.
 *
 * Llega la lista completa y se reescribe entera. Las de importe cero se
 * descartan en el almacén, que es lo mismo que borrarlas: sin tarifa propia,
 * `rateFor` cae en las tarifas antiguas de la ficha.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
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

  const creator = await setCreatorRates(id, parsed.data.rates);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  revalidatePath("/campanas/nueva");
  return NextResponse.json({ creator });
}
