import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCompany, newId } from "@/lib/store";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Empresa o persona natural. */
  kind: z.enum(["empresa", "persona"]).default("empresa"),
  name: z.string({ error: "Falta el nombre." }).min(1, "Falta el nombre."),
  industry: z.string().default("Otro"),
  website: z.string().nullable().default(null),
  contactName: z.string().default(""),
  contactRole: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  socials: z
    .object({
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .default({}),
  status: z.enum(["activo", "prospecto", "inactivo"]).default("prospecto"),
  notes: z.string().default(""),
});

export async function POST(request: Request) {
  // Faltaba comprobar nada: bastaba con tener sesión para dar de alta un
  // cliente. El middleware no cubre las rutas de API.
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_empresas")) {
    return NextResponse.json({ error: "Tu rol no permite crear empresas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  // El contacto del alta se guarda además como contacto principal.
  const company = await createCompany({
    ...parsed.data,
    contactFields: [],
    contacts: parsed.data.contactName.trim()
      ? [
          {
            id: newId("ct"),
            name: parsed.data.contactName,
            role: parsed.data.contactRole,
            email: parsed.data.email,
            phone: parsed.data.phone,
            primary: true,
            notes: "",
          },
        ]
      : [],
  });

  revalidatePath("/empresas");
  revalidatePath("/");
  return NextResponse.json({ company }, { status: 201 });
}
