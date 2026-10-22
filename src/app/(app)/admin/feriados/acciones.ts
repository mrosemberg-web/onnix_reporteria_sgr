"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export type EstadoFeriado = { error?: string; ok?: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function agregarFeriado(_: EstadoFeriado, fd: FormData): Promise<EstadoFeriado> {
  await requerirAdmin();
  const fecha = String(fd.get("fecha") ?? "");
  const descripcion = String(fd.get("descripcion") ?? "").trim().slice(0, 160);
  const tipo = ["fijo", "trasladado", "extraordinario"].includes(String(fd.get("tipo"))) ? String(fd.get("tipo")) : "fijo";
  const original = String(fd.get("fecha_original") ?? "");
  if (!FECHA.test(fecha)) return { error: "Indicá la fecha." };
  if (!descripcion) return { error: "Indicá el motivo del feriado." };
  if (tipo === "trasladado" && !FECHA.test(original)) return { error: "Para un feriado trasladado, indicá la fecha que conmemora." };
  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  await sql`
    insert into feriados (fecha, descripcion, tipo, fecha_original)
    values (${fecha}, ${descripcion}, ${tipo}, ${tipo === "trasladado" ? original : null})
    on conflict (fecha) do update set descripcion = excluded.descripcion, tipo = excluded.tipo, fecha_original = excluded.fecha_original`;
  revalidatePath("/", "layout");
  return { ok: dow === 0 || dow === 6
    ? "Feriado guardado. Cae en fin de semana, así que no cambia los días hábiles; si se trasladó, cargá también la fecha trasladada."
    : "Feriado guardado. Los reportes ya lo toman en cuenta." };
}

export async function eliminarFeriado(fd: FormData) {
  await requerirAdmin();
  const fecha = String(fd.get("fecha") ?? "");
  if (FECHA.test(fecha)) await sql`delete from feriados where fecha = ${fecha}`;
  revalidatePath("/", "layout");
}
