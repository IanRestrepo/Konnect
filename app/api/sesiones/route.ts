import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { createCollabSession, listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre de la sesión." }).min(1, "Falta el nombre de la sesión."),
  campaignId: z.string().nullable().default(null),
  creatorId: z.string().nullable().default(null),
  notes: z.string().default(""),
  showMetrics: z.boolean().default(true),
  /** Cada entrada genera su propio código de acceso. */
  accesses: z
    .array(
      z.object({
        role: z.enum(["creador", "cliente", "invitado"]),
        label: z.string().min(1, "Cada acceso necesita un nombre."),
        canUpload: z.boolean().default(true),
      }),
    )
    .min(1, "Crea al menos un acceso."),
});

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "ver_sesiones")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }
  return NextResponse.json({ sessions: await listSessions() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite crear sesiones." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const creada = await createCollabSession(parsed.data);

  revalidatePath("/sesiones");
  return NextResponse.json({ session: creada }, { status: 201 });
}
