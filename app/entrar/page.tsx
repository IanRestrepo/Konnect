import { Suspense } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/app/entrar/login-form";
import { LoginArt } from "@/app/entrar/login-art";

export const metadata = { title: "Entrar — Konnect" };
export const dynamic = "force-dynamic";

/**
 * Si dejas una foto en `public/brand/`, el panel derecho la usa.
 * Sin foto, cae en el lienzo de marca.
 */
const CANDIDATES = ["login.jpg", "login.jpeg", "login.png", "login.webp"];

async function findArtwork(): Promise<string | null> {
  for (const file of CANDIDATES) {
    try {
      await fs.access(path.join(process.cwd(), "public", "brand", file));
      return `/brand/${file}`;
    } catch {
      // seguimos probando
    }
  }
  return null;
}

export default async function EntrarPage() {
  const session = await getSession();
  if (session) redirect("/");

  const artwork = await findArtwork();

  return (
    <div className="grid min-h-dvh bg-[#08080a] lg:grid-cols-2">
      <Suspense>
        <LoginForm />
      </Suspense>
      <LoginArt src={artwork} />
    </div>
  );
}
