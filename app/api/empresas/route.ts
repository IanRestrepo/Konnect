import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCompany, newId } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre de la empresa." }).min(1, "Falta el nombre de la empresa."),
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
