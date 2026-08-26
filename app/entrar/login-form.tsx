"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { KonnectMark } from "@/components/brand/logo";

/* Superficie siempre oscura: no sigue el tema de la aplicación. */
const INPUT =
  "h-12 w-full rounded-[10px] border border-transparent bg-[#eceffc] px-4 text-[14px] text-[#16161a] " +
  "outline-none transition placeholder:text-[#8b8fa3] focus:border-[#0046d9] focus:bg-white";

export function LoginForm() {
  const router = useRouter();
  const destino = useSearchParams().get("destino") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ayuda, setAyuda] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos iniciar sesión.");

      router.replace(destino.startsWith("/") ? destino : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-14">
      <span className="text-white">
        <KonnectMark size={26} />
      </span>

      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
        <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em] text-white">
          Bienvenido
        </h1>
        <p className="mt-2 text-[14px] text-white/55">
          Accede a tu panel de gestión.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] text-white/70">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@agencia.com"
              autoComplete="email"
              autoFocus
              required
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] text-white/70">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={verClave ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className={`${INPUT} pr-11`}
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-[#8b8fa3] transition hover:text-[#16161a]"
              >
                {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAyuda((v) => !v)}
                className="text-[12.5px] text-white/50 transition hover:text-white/80"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {ayuda && (
            <p className="rounded-[10px] bg-white/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white/60">
              Un administrador puede asignarte una nueva desde Configuración → Usuarios. Todavía no
              hay recuperación por correo.
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-[10px] bg-[#f0737314] px-3.5 py-2.5 text-[12.5px] text-[#ff9b9b]">
              <TriangleAlert size={14} className="mt-px shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-white text-[14px] font-semibold text-[#08080a] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <LoaderCircle size={16} className="animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="mt-7 text-center text-[12.5px] text-white/40">
          ¿Sin acceso?{" "}
          <span className="font-medium text-white/70">Pídeselo a un administrador</span>
        </p>
      </div>
    </div>
  );
}
