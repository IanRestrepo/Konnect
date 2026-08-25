import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCreator, newId } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/socials";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre." }).min(1, "Falta el nombre."),
  handle: z.string().default(""),
  /** Dónde vive el creador. Solo YouTube trae datos de la API. */
  mainPlatform: z
    .enum(["youtube", "instagram", "tiktok", "x", "twitch", "kick", "discord", "roblox", "web"])
    .default("youtube"),
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
  /** Perfiles del creador, cada uno con sus propias métricas. */
  socials: z
    .array(
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

  const { socials, ...datos } = parsed.data;

  const creator = await createCreator({
    ...datos,
    channels: [],
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
