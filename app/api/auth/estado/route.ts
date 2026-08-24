import { NextResponse } from "next/server";
import { countUsers } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Le dice al login si hay que crear la primera cuenta de administración. */
export async function GET() {
  return NextResponse.json({ necesitaCuentaInicial: (await countUsers()) === 0 });
}
