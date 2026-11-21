import { z } from "zod";
import { generarContrato } from "@/lib/blackbull/contrato";
import { CURRENCIES } from "@/lib/labels";
import { requirePermission } from "@/lib/session";

export const runtime = "nodejs";

const contrato = z.object({
  tipo: z.enum(["empresa", "influencer"]),
  contraparte: z.string().trim().min(1).max(180).regex(/^[^\p{Cc}\p{Cf}]+$/u),
  valor: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).transform(Number).pipe(z.number().positive()),
  moneda: z.enum(CURRENCIES),
});

export async function POST(request: Request) {
  await requirePermission("ver_contratos");
  const datos = contrato.safeParse(await request.json().catch(() => null));
  if (!datos.success) {
    return Response.json({ error: "Revisa el nombre, el tipo, el valor y la moneda del contrato." }, { status: 400 });
  }
  const pdf = await generarContrato(datos.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-konnect-${datos.data.tipo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
