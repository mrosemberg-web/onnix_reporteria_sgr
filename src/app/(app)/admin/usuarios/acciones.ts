"use server";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { nuevoToken, requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export type EstadoInvitacion = { error?: string; enlace?: string; vence?: string };

async function origen() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function crearInvitacion(_: EstadoInvitacion, fd: FormData): Promise<EstadoInvitacion> {
  const s = await requerirAdmin();
  const rol = fd.get("rol") === "admin" ? "admin" : "lector";
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 120) || null;
  const dias = Math.min(Math.max(Number(fd.get("dias")) || 7, 1), 30);
  const { token, hash } = nuevoToken();
  const [inv] = await sql<{ expira_en: Date }[]>`
    insert into invitaciones (token_hash, rol, nota, creada_por, expira_en)
    values (${hash}, ${rol}, ${nota}, ${s.uid}, now() + make_interval(days => ${dias}))
    returning expira_en`;
  revalidatePath("/admin/usuarios");
  return { enlace: `${await origen()}/invitacion/${token}`, vence: inv.expira_en.toISOString() };
}

export async function revocarInvitacion(fd: FormData) {
  await requerirAdmin();
  await sql`update invitaciones set revocada = true where id = ${Number(fd.get("id"))} and usada_en is null`;
  revalidatePath("/admin/usuarios");
}

async function quedanOtrosAdmins(id: number) {
  const [r] = await sql<{ n: number }[]>`select count(*) as n from usuarios where rol = 'admin' and activo and id <> ${id}`;
  return r.n > 0;
}

export async function cambiarActivo(fd: FormData) {
  const s = await requerirAdmin();
  const id = Number(fd.get("id"));
  const activo = fd.get("activo") === "si";
  if (id === s.uid) return;
  if (!activo && !(await quedanOtrosAdmins(id))) return;
  await sql`update usuarios set activo = ${activo}, intentos_fallidos = 0, bloqueado_hasta = null where id = ${id}`;
  revalidatePath("/admin/usuarios");
}

export async function cambiarRol(fd: FormData) {
  const s = await requerirAdmin();
  const id = Number(fd.get("id"));
  const rol = fd.get("rol") === "admin" ? "admin" : "lector";
  if (id === s.uid) return;
  if (rol === "lector" && !(await quedanOtrosAdmins(id))) return;
  await sql`update usuarios set rol = ${rol} where id = ${id}`;
  revalidatePath("/admin/usuarios");
}

export type EstadoTemporal = { clave?: string; error?: string };

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Genera una clave temporal para quien la olvidó. Se muestra una sola vez. */
export async function claveTemporal(_: EstadoTemporal, fd: FormData): Promise<EstadoTemporal> {
  const s = await requerirAdmin();
  const id = Number(fd.get("id"));
  if (id === s.uid) return { error: "Para tu propia clave usá Mi cuenta." };
  let clave = "";
  for (let i = 0; i < 12; i++) clave += ALFABETO[randomInt(ALFABETO.length)];
  clave += String(randomInt(10, 99));
  await sql`update usuarios set clave_hash = ${await bcrypt.hash(clave, 12)}, intentos_fallidos = 0, bloqueado_hasta = null where id = ${id}`;
  return { clave };
}
