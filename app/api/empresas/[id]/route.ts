import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateCompany } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1, "Falta el nombre de la empresa.").optional(),
  industry: z.string().optional(),
  website: z.string().nullable().optional(),
  status: z.enum(["activo", "prospecto", "inactivo"]).optional(),
  notes: z.string().optional(),
  socials: z
    .object({
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_empresas")) {
    return NextResponse.json({ error: "Tu rol no permite editar empresas." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const company = await updateCompany(id, parsed.data);
  if (!company) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  revalidatePath("/empresas");
  revalidatePath(`/empresas/${id}`);
  revalidatePath("/");
  return NextResponse.json({ company });
}
