"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { iniciarSesion } from "@/lib/auth";
import { asegurarConexion, sql } from "@/lib/db";
import { describirError } from "@/lib/diagnostico";

// Hash de una clave aleatoria: iguala el tiempo de respuesta cuando el usuario no existe.
const HASH_FICTICIO = "$2b$12$2orps2PHGe3e9ZZ1DiguVOvb9wfREKRN8bxF3hX8SAKLyZ7BqfiDa";
const MAX_INTENTOS = 5;

export type EstadoForm = { error?: string; usuario?: string; intento?: number };

export async function ingresar(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuario = String(fd.get("usuario") ?? "").trim();
  const clave = String(fd.get("clave") ?? "");
  // React reinicia el formulario tras cada envío: devolvemos el usuario para no obligar a reescribirlo.
  const fallo = (error: string): EstadoForm => ({ error, usuario, intento: (prev.intento ?? 0) + 1 });
  if (!usuario || !clave) return fallo("Ingresá usuario y clave.");

  try {
    await asegurarConexion();
    const [u] = await sql<{ id: number; usuario: string; nombre: string; rol: "admin" | "lector"; clave_hash: string;
                            activo: boolean; bloqueado: boolean }[]>`
      select id, usuario, nombre, rol, clave_hash, activo, coalesce(bloqueado_hasta > now(), false) as bloqueado
      from usuarios where lower(usuario) = lower(${usuario})`;

    const ok = await bcrypt.compare(clave, u?.clave_hash ?? HASH_FICTICIO);
    if (u?.bloqueado) return fallo("Demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.");
    if (!u || !ok || !u.activo) {
      if (u) {
        await sql`update usuarios
                  set intentos_fallidos = intentos_fallidos + 1,
                      bloqueado_hasta = case when intentos_fallidos + 1 >= ${MAX_INTENTOS} then now() + interval '15 minutes' end
                  where id = ${u.id}`;
      }
      return fallo("Usuario o clave incorrectos.");
    }
    await sql`update usuarios set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_acceso = now() where id = ${u.id}`;
    await iniciarSesion({ uid: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
  } catch (e) {
    const d = describirError(e);
    console.error("Error al ingresar:", d.codigo, e);
    return fallo(`No se pudo ingresar: ${d.mensaje} (código ${d.codigo})`);
  }
  redirect("/");
}
