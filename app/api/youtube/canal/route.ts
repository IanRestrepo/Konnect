import { NextResponse } from "next/server";
import { fetchChannel, hasApiKey } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = url.searchParams.get("url") ?? "";

  if (!input.trim()) {
    return NextResponse.json({ error: "Falta el enlace del canal." }, { status: 400 });
  }

  try {
    const channel = await fetchChannel(input);
    return NextResponse.json({ channel, demo: !(await hasApiKey()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
