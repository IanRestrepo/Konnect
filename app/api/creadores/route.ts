import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCreator } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre." }).min(1, "Falta el nombre."),
  handle: z.string().default(""),
  channelId: z.string().default(""),
  channelUrl: z.string().default(""),
  avatarUrl: z.string().nullable().default(null),
  country: z.string().default(""),
  category: z.string({ error: "Falta la categoría." }).min(1, "Falta la categoría."),
  status: z.enum(["activo", "pausado", "prospecto", "archivado"]).default("prospecto"),
  email: z.string().default(""),
  phone: z.string().default(""),
  totalViews: z.number().default(0),
  subscribers: z.number().default(0),
  videoCount: z.number().default(0),
  currency: z.enum(["USD", "MXN", "COP", "EUR"]).default("USD"),
  rateVideo: z.number().default(0),
  rateShort: z.number().default(0),
  rateIntegration: z.number().default(0),
  paymentMethods: z
    .array(z.enum(["transferencia", "paypal", "wise", "binance", "deel", "efectivo"]))
    .default([]),
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
    .default({
      holder: "",
      bankName: "",
      accountNumber: "",
      routing: "",
      taxId: "",
    }),
  notes: z.string().default(""),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const creator = await createCreator({
    ...parsed.data,
    channels: [],
    socials: [],
    metricsUpdatedAt: new Date().toISOString(),
  });

  revalidatePath("/creadores");
  revalidatePath("/");
  return NextResponse.json({ creator }, { status: 201 });
}
