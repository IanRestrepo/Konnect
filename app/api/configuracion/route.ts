import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSettings, saveSettings } from "@/lib/store";
import { resolveApiKey } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/** Nunca devolvemos la clave completa: solo si está puesta y de dónde viene. */
export async function GET() {
  const settings = await getSettings();
  const fromEnv = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  const stored = settings.youtubeApiKey?.trim() ?? "";

  return NextResponse.json({
    youtube: {
      configured: fromEnv || Boolean(stored),
      source: fromEnv ? "entorno" : stored ? "aplicación" : null,
      hint: stored ? `••••${stored.slice(-4)}` : null,
    },
  });
}

const schema = z.object({
  youtubeApiKey: z.string().default(""),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const key = parsed.data.youtubeApiKey.trim();
  await saveSettings({ youtubeApiKey: key || undefined });

  revalidatePath("/configuracion");
  return NextResponse.json({ ok: true, configured: Boolean(await resolveApiKey()) });
}
