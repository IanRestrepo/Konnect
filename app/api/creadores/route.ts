import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCreator, newId } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/socials";
import { IMPORTE_MAXIMO } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const plataforma = z.enum([
  "youtube",
  "instagram",
  "tiktok",
  "x",
  "twitch",
  "kick",
  "discord",
  "roblox",
  "web",
]);

const metodo = z.enum(["transferencia", "paypal", "wise", "binance", "deel", "efectivo"]);

const schema = z.object({
  name: z.string({ error: "Falta el nombre." }).min(1, "Falta el nombre."),
  handle: z.string().default(""),
  /** Dónde vive el creador. Solo YouTube trae datos de la API. */
  mainPlatform: plataforma.default("youtube"),
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
  /** Precio base por red y tipo de pieza. Lo que manda al armar una campaña. */
  rates: z
    .array(
      z.object({
        platform: plataforma,
        type: z.enum(["video", "short", "integracion", "directo", "post"]),
        amount: z.number().min(0).max(IMPORTE_MAXIMO, "Ese importe no cabe.").default(0),
      }),
    )
    .default([]),
  paymentMethods: z.array(metodo).default([]),
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
  /** Una cuenta de cobro por método: banco, PayPal, Binance… */
  bankAccounts: z
    .array(
      z.object({
        method: metodo,
        label: z.string().default(""),
        holder: z.string().default(""),
        bankName: z.string().default(""),
        reference: z.string().default(""),
        routing: z.string().default(""),
        notes: z.string().default(""),
      }),
    )
    .default([]),
  /** Contactos de nombre libre: Discord, Telegram, el correo del mánager… */
  contactFields: z
    .array(
      z.object({
        label: z.string().min(1, "Cada contacto necesita un nombre de campo."),
        value: z.string().default(""),
      }),
    )
    .default([]),
  notes: z.string().default(""),
  /** Perfiles del creador, cada uno con sus propias métricas. */
  socials: z
    .array(
      z.object({
        platform: plataforma,
        handle: z.string().min(1),
        url: z.string().default(""),
        followers: z.number().min(0).default(0),
      }),
    )
    .default([]),
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

  const { socials, rates, bankAccounts, contactFields, ...datos } = parsed.data;

  const creator = await createCreator({
    ...datos,
    channels: [],
    // Los ids los pone la base; aquí sólo hace falta que el tipo cuadre.
    rates: rates.map((r) => ({ ...r, id: "" })),
    contacts: [],
    contactFields: contactFields.map((f) => ({ ...f, id: "", label: f.label.trim() })),
    bankAccounts: bankAccounts.map((a) => ({ ...a, id: "" })),
    socials: socials.map((s) => ({
      id: newId("so"),
      platform: s.platform,
      handle: s.handle.trim(),
      url: s.url.trim() || PLATFORM_URL[s.platform](s.handle.trim()),
      avatarUrl: null,
      followers: s.followers,
      totalViews: 0,
      contentCount: 0,
      metricsUpdatedAt: null,
    })),
    metricsUpdatedAt: new Date().toISOString(),
  });

  revalidatePath("/creadores");
  revalidatePath("/");
  return NextResponse.json({ creator }, { status: 201 });
}
