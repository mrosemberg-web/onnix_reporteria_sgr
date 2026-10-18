"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { hashToken, iniciarSesion, REGLA_USUARIO, validarClave } from "@/lib/auth";
import { asegurarConexion, sql } from "@/lib/db";

export type EstadoInvitacion = { error?: string; nombre?: string; usuario?: string; intento?: number };

export async function aceptarInvitacion(prev: EstadoInvitacion, fd: FormData): Promise<EstadoInvitacion> {
  const token = String(fd.get("token") ?? "");
  const nombre = String(fd.get("nombre") ?? "").trim();
  const usuario = String(fd.get("usuario") ?? "").trim();
  const clave = String(fd.get("clave") ?? "");
  const confirmar = String(fd.get("confirmar") ?? "");
  const fallo = (error: string): EstadoInvitacion => ({ error, nombre, usuario, intento: (prev.intento ?? 0) + 1 });

  if (nombre.length < 3) return fallo("Ingresá tu nombre y apellido.");
  if (!REGLA_USUARIO.test(usuario)) return fallo("El usuario debe tener de 3 a 40 caracteres: letras, números, punto, guion o guion bajo.");
  const errClave = validarClave(clave);
  if (errClave) return fallo(errClave);
  if (clave !== confirmar) return fallo("Las claves no coinciden.");

  await asegurarConexion();
  const hash = await bcrypt.hash(clave, 12);
  const resultado = await sql.begin(async (tx) => {
    const [inv] = await tx<{ id: number; rol: "admin" | "lector" }[]>`
      select id, rol from invitaciones
      where token_hash = ${hashToken(token)} and usada_en is null and not revocada and expira_en > now()
      for update`;
    if (!inv) return { error: "La invitación ya se usó, venció o fue revocada. Pedí un enlace nuevo." } as const;
    const [existe] = await tx`select 1 from usuarios where lower(usuario) = lower(${usuario})`;
    if (existe) return { error: "Ese usuario ya está en uso. Elegí otro." } as const;
    const [u] = await tx<{ id: number }[]>`
      insert into usuarios (usuario, nombre, clave_hash, rol, ultimo_acceso)
      values (${usuario}, ${nombre}, ${hash}, ${inv.rol}, now()) returning id`;
    await tx`update invitaciones set usada_en = now(), usada_por = ${u.id} where id = ${inv.id}`;
    return { ok: { uid: u.id, rol: inv.rol } } as const;
  });

  if ("error" in resultado) return fallo(resultado.error ?? "No se pudo crear el usuario.");
  await iniciarSesion({ uid: resultado.ok.uid, usuario, nombre, rol: resultado.ok.rol });
  redirect("/");
}
