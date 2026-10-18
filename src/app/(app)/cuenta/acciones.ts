"use server";
import bcrypt from "bcryptjs";
import { requerirSesion, validarClave } from "@/lib/auth";
import { sql } from "@/lib/db";

export type EstadoClave = { error?: string; ok?: string };

export async function cambiarClave(_: EstadoClave, fd: FormData): Promise<EstadoClave> {
  const s = await requerirSesion();
  const actual = String(fd.get("actual") ?? "");
  const nueva = String(fd.get("nueva") ?? "");
  const confirmar = String(fd.get("confirmar") ?? "");
  const [u] = await sql<{ clave_hash: string }[]>`select clave_hash from usuarios where id = ${s.uid}`;
  if (!u || !(await bcrypt.compare(actual, u.clave_hash))) return { error: "La clave actual no es correcta." };
  const err = validarClave(nueva);
  if (err) return { error: err };
  if (nueva !== confirmar) return { error: "Las claves nuevas no coinciden." };
  await sql`update usuarios set clave_hash = ${await bcrypt.hash(nueva, 12)} where id = ${s.uid}`;
  return { ok: "Clave actualizada." };
}
