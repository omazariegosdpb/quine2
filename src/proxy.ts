import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/reglas",
  "/api/health",
]);

const CHANGE_PASSWORD_PATH = "/cambio-password";

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/logo")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, mustChangePassword, isActive } = await updateSession(request);

  // 1) Cuenta inactiva (retirada/anonimizada): forzamos logout + login.
  if (user && !isActive) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("inactive", "1");
    // No podemos hacer signOut desde el proxy fácilmente; el cliente se renovará al ir al login.
    const redirect = NextResponse.redirect(url);
    // Limpiamos las cookies de sesión de Supabase
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) redirect.cookies.delete(c.name);
    }
    return redirect;
  }

  // 2) Usuario logueado que DEBE cambiar la contraseña:
  //    forzamos /cambio-password en TODA navegación (incluso rutas públicas como /reglas o /login).
  //    APIs: 403 directo (la UI no debería poder llamarlas en este estado).
  if (user && mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    if (isApi(pathname)) {
      return NextResponse.json(
        { error: "must-change-password", hint: `Cambia tu contraseña en ${CHANGE_PASSWORD_PATH} antes de continuar.` },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) Rutas públicas: pasan (asumiendo que ya no se requiere cambio de password).
  if (isPublic(pathname)) return response;

  // 4) Rutas privadas sin sesión: a /login con next.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
