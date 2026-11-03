import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { asegurarConexion, sql } from "./db";
import { inicioDe, seccionesValidas, TODAS, type Seccion } from "./secciones";
import { COOKIE_SESION, DURACION_SESION_S, firmarSesion, verificarSesion, type Sesion } from "./token";

export type { Sesion, Rol } from "./token";

export async function iniciarSesion(s: Sesion) {
  const token = await firmarSesion(s);
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_S,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_SESION);
}

export type SesionActual = Sesion & { secciones: Seccion[] };

/** Lee la sesión y confirma contra la base que el usuario siga activo (con su rol y secciones actuales). */
export async function obtenerSesion(): Promise<SesionActual | null> {
  const s = await verificarSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s) return null;
  await asegurarConexion();
  const [u] = await sql<{ id: number; usuario: string; nombre: string; rol: "admin" | "lector"; activo: boolean; secciones: string[] }[]>`
    select id, usuario, nombre, rol, activo, secciones from usuarios where id = ${s.uid}`;
  if (!u || !u.activo) return null;
  // Los administradores ven todas las secciones.
  const secciones = u.rol === "admin" ? TODAS : seccionesValidas(u.secciones);
  return { uid: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, secciones };
}

export async function requerirSesion() {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  return s;
}

/** Exige acceso a una sección; si no lo tiene, lo lleva a la primera sección que sí puede ver. */
export async function requerirSeccion(seccion: Seccion) {
  const s = await requerirSesion();
  if (!s.secciones.includes(seccion)) redirect(inicioDe(s.secciones));
  return s;
}

export async function requerirAdmin() {
  const s = await requerirSesion();
  if (s.rol !== "admin") redirect("/");
  return s;
}

export function nuevoToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const REGLA_USUARIO = /^[a-zA-Z0-9._-]{3,40}$/;
export const MIN_CLAVE = 10;

export function validarClave(clave: string): string | null {
  if (clave.length < MIN_CLAVE) return `La clave debe tener al menos ${MIN_CLAVE} caracteres.`;
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return "La clave debe combinar letras y números.";
  return null;
}
