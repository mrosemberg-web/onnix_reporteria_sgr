import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "./lib/token";

// Rutas accesibles sin sesión.
const PUBLICAS = [/^\/login$/, /^\/invitacion\/[^/]+$/, /^\/api\/salud$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((r) => r.test(pathname))) return NextResponse.next();

  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (sesion) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
