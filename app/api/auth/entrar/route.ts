import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_OPTIONS, SESSION_COOKIE } from "@/lib/auth";
import { authenticate } from "@/lib/auth-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string({ error: "Falta el correo." }).min(1, "Falta el correo."),
  password: z.string({ error: "Falta la contraseña." }).min(1, "Falta la contraseña."),
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

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const response = NextResponse.json({ session: result.session });
  response.cookies.set(SESSION_COOKIE, result.token, COOKIE_OPTIONS);
  return response;
}
