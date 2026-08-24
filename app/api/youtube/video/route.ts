import { NextResponse } from "next/server";
import { fetchVideo, hasApiKey } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = url.searchParams.get("url") ?? "";

  if (!input.trim()) {
    return NextResponse.json({ error: "Falta el enlace del video." }, { status: 400 });
  }

  try {
    const video = await fetchVideo(input);
    return NextResponse.json({ video, demo: !(await hasApiKey()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
