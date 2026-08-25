import { NextResponse } from "next/server";
import { PORTAL_COOKIE } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PORTAL_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
