"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth";
import { sql, transaccion } from "@/lib/db";
import { feriadosDelAnio, lunesCercanos, motivoBase } from "@/lib/feriados";

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
    insert into feriados (fecha, descripcion, tipo, fecha_original, movil)
    values (${fecha}, ${descripcion}, ${tipo}, ${tipo === "trasladado" ? original : null}, ${tipo === "trasladado"})
    on conflict (fecha) do update set descripcion = excluded.descripcion, tipo = excluded.tipo,
      fecha_original = excluded.fecha_original, movil = excluded.movil`;
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

/** Carga los feriados de un año en su fecha legal. No pisa nada de lo que ya exista. */
export async function precargarAnio(_: EstadoFeriado, fd: FormData): Promise<EstadoFeriado> {
  await requerirAdmin();
  const anio = Number(fd.get("anio"));
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return { error: "Indicá un año entre 2020 y 2100." };
  const existentes = await sql<{ fecha: string; fecha_original: string | null }[]>`
    select fecha, fecha_original from feriados where extract(year from fecha) = ${anio} or extract(year from fecha_original) = ${anio}`;
  const fechas = new Set(existentes.map((e) => e.fecha));
  const trasladados = new Set(existentes.map((e) => e.fecha_original).filter(Boolean));
  const nuevos = feriadosDelAnio(anio).filter((f) => !fechas.has(f.fecha) && !trasladados.has(f.fecha));
  if (nuevos.length) {
    await sql`insert into feriados ${sql(nuevos.map((f) => ({ ...f, tipo: "fijo" })), "fecha", "descripcion", "tipo", "movil")}
      on conflict (fecha) do nothing`;
  }
  revalidatePath("/", "layout");
  const omitidos = feriadosDelAnio(anio).length - nuevos.length;
  return { ok: nuevos.length
    ? `Se cargaron ${nuevos.length} feriados de ${anio}${omitidos ? ` (${omitidos} ya estaban cargados o trasladados)` : ""}. Los móviles quedaron en su fecha legal: trasladalos cuando salga el decreto.`
    : `Los feriados de ${anio} ya estaban cargados; no se cambió nada.` };
}

/** Traslada un feriado móvil al lunes anterior o siguiente, como permite la ley. */
export async function trasladarFeriado(_: EstadoFeriado, fd: FormData): Promise<EstadoFeriado> {
  await requerirAdmin();
  const fecha = String(fd.get("fecha") ?? "");
  const destino = String(fd.get("destino") ?? "");
  const decreto = String(fd.get("decreto") ?? "").trim().slice(0, 40);
  const lunes = FECHA.test(fecha) ? lunesCercanos(fecha) : null;
  if (!lunes || (destino !== "anterior" && destino !== "siguiente")) return { error: "Traslado inválido." };
  const nueva = lunes[destino];
  const res = await transaccion(async (tx) => {
    const [f] = await tx<{ descripcion: string; movil: boolean; tipo: string }[]>`
      select descripcion, movil, tipo from feriados where fecha = ${fecha} for update`;
    if (!f || !f.movil || f.tipo === "trasladado") return "Solo se pueden trasladar feriados móviles que estén en su fecha legal.";
    const [ocupada] = await tx`select 1 from feriados where fecha = ${nueva}`;
    if (ocupada) return `El ${nueva.split("-").reverse().join("/")} ya es feriado.`;
    const motivo = `${motivoBase(f.descripcion)}${decreto ? ` (Decreto ${decreto.replace(/^decreto\s*/i, "")})` : ""}`;
    await tx`insert into feriados (fecha, descripcion, tipo, fecha_original, movil) values (${nueva}, ${motivo}, 'trasladado', ${fecha}, true)`;
    await tx`delete from feriados where fecha = ${fecha}`;
    return null;
  });
  if (res) return { error: res };
  revalidatePath("/", "layout");
  return { ok: `Trasladado al lunes ${nueva.split("-").reverse().join("/")}.` };
}

/** Vuelve un feriado trasladado a su fecha legal (por ejemplo, si se cargó por error). */
export async function deshacerTraslado(fd: FormData) {
  await requerirAdmin();
  const fecha = String(fd.get("fecha") ?? "");
  if (!FECHA.test(fecha)) return;
  await transaccion(async (tx) => {
    const [f] = await tx<{ descripcion: string; fecha_original: string | null }[]>`
      select descripcion, fecha_original from feriados where fecha = ${fecha} and tipo = 'trasladado' for update`;
    if (!f?.fecha_original) return;
    await tx`delete from feriados where fecha = ${fecha}`;
    await tx`insert into feriados (fecha, descripcion, tipo, movil) values (${f.fecha_original}, ${motivoBase(f.descripcion)}, 'fijo', true)
      on conflict (fecha) do nothing`;
  });
  revalidatePath("/", "layout");
}
