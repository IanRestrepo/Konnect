import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateCreator } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1, "Falta el nombre.").optional(),
  handle: z.string().optional(),
  country: z.string().optional(),
  category: z.string().min(1, "Falta la categoría.").optional(),
  status: z.enum(["activo", "pausado", "prospecto", "archivado"]).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  currency: z.enum(["USD", "MXN", "COP", "EUR"]).optional(),
  rateVideo: z.number().min(0).optional(),
  rateShort: z.number().min(0).optional(),
  rateIntegration: z.number().min(0).optional(),
  paymentMethods: z
    .array(z.enum(["transferencia", "paypal", "wise", "binance", "deel", "efectivo"]))
    .optional(),
  notes: z.string().optional(),
  /** Opcional: si no viene, los datos cifrados se dejan como están. */
  banking: z
    .object({
      holder: z.string().default(""),
      bankName: z.string().default(""),
      accountNumber: z.string().default(""),
      routing: z.string().default(""),
      taxId: z.string().default(""),
      paypalEmail: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }

  // Reescribir los datos bancarios exige la misma llave que verlos.
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  if (parsed.data.banking && !hasPermission(session.permissions, "ver_datos_bancarios")) {
    return NextResponse.json(
      { error: "Tu rol no permite cambiar la información de pago." },
      { status: 403 },
    );
  }

  const creator = await updateCreator(id, parsed.data);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath("/creadores");
  revalidatePath(`/creadores/${id}`);
  revalidatePath("/");
  return NextResponse.json({ creator });
}
