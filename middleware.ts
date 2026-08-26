import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/lib/auth";
import { hasPermission, permissionForPath, firstAllowedPath } from "@/lib/permissions";

/** Rutas accesibles sin sesión. */
const PUBLIC = ["/entrar", "/api/auth/entrar"];

/**
 * El portal de sesiones es para gente de fuera: entra con un código, no con
 * una cuenta. Su propio token se valida en cada ruta, no aquí.
 */
const PORTAL = ["/portal", "/api/portal"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  if (PORTAL.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  const session = await readToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    // Las llamadas de API responden 401; la navegación va al login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("destino", pathname);
    return NextResponse.redirect(url);
  }

  const required = permissionForPath(pathname);
  if (required && !hasPermission(session.permissions, required)) {
    const url = request.nextUrl.clone();
    url.pathname = firstAllowedPath(session.permissions);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
