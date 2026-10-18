// Firma y verificación de la sesión (compatible con Edge para el middleware).
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const COOKIE_SESION = "sesion";
export const DURACION_SESION_S = 8 * 60 * 60;

export type Rol = "admin" | "lector";
export type Sesion = { uid: number; usuario: string; nombre: string; rol: Rol };

function secreto() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function firmarSesion(s: Sesion) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_S}s`)
    .sign(secreto());
}

export async function verificarSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.usuario !== "string") return null;
    return {
      uid: payload.uid,
      usuario: payload.usuario,
      nombre: String(payload.nombre ?? payload.usuario),
      rol: payload.rol === "admin" ? "admin" : "lector",
    };
  } catch {
    return null;
  }
}
