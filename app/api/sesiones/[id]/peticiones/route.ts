import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import {
  addRequirement,
  removeRequirement,
  reviewRequirement,
  updateRequirement,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const KINDS = ["entregable", "guion", "borrador", "referencia", "nota"] as const;

const crear = z.object({
  kind: z.enum(KINDS).default("entregable"),
  title: z.string().min(1, "Ponle un título a la petición."),
  instructions: z.string().default(""),
  /** Pasos concretos, p. ej. «añadir el enlace en la descripción». */
  steps: z.array(z.string().min(1)).default([]),
  required: z.boolean().default(true),
});

/** Crea una petición del checklist. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("editar_sesiones");
  const { id } = await params;

  const parsed = crear.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const actualizada = await addRequirement(id, parsed.data);
  if (!actualizada) {
    return NextResponse.json({ error: "Esa sesión no existe." }, { status: 404 });
  }

  revalidatePath(`/sesiones/${id}`);
  revalidatePath(`/portal/${id}`);
  void session;

  return NextResponse.json(actualizada, { status: 201 });
}

const revisar = z.object({
  requirementId: z.string().min(1),
  accion: z.enum(["aprobar", "cambios", "editar"]),
  reviewNotes: z.string().default(""),
  title: z.string().optional(),
  instructions: z.string().optional(),
  steps: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

/** Aprueba, pide cambios o edita una petición existente. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("editar_sesiones");
  const { id } = await params;

  const parsed = revisar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { requirementId, accion, reviewNotes, ...campos } = parsed.data;

  const actualizada =
    accion === "editar"
      ? await updateRequirement(id, requirementId, campos)
      : await reviewRequirement(id, requirementId, {
          aprobado: accion === "aprobar",
          reviewNotes,
          actorLabel: session.name,
        });

  if (!actualizada) {
    return NextResponse.json({ error: "Esa petición no existe." }, { status: 404 });
  }

  revalidatePath(`/sesiones/${id}`);
  revalidatePath(`/portal/${id}`);

  return NextResponse.json(actualizada);
}

/** Elimina una petición del checklist. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("editar_sesiones");
  const { id } = await params;

  const requirementId = new URL(request.url).searchParams.get("requirementId");
  if (!requirementId) {
    return NextResponse.json({ error: "Falta la petición." }, { status: 400 });
  }

  if (!(await removeRequirement(id, requirementId))) {
    return NextResponse.json({ error: "Esa petición no existe." }, { status: 404 });
  }

  revalidatePath(`/sesiones/${id}`);
  revalidatePath(`/portal/${id}`);

  return NextResponse.json({ ok: true });
}
