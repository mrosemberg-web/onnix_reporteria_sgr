"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth";
import { importarArchivo, type ResultadoImportacion } from "@/lib/importar";

export type EstadoCarga = { estado: "inicial" } | { estado: "listo"; resultados: ResultadoImportacion[]; error?: string };

const MAX_BYTES = 4 * 1024 * 1024;

export async function cargarPlanillas(_: EstadoCarga, fd: FormData): Promise<EstadoCarga> {
  const s = await requerirAdmin();
  const archivos = fd.getAll("archivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (!archivos.length) return { estado: "listo", resultados: [], error: "Elegí al menos un archivo CSV." };
  if (archivos.length > 3) return { estado: "listo", resultados: [], error: "Podés subir hasta 3 archivos a la vez (uno de cada tipo)." };
  if (fd.get("confirmo") !== "si") return { estado: "listo", resultados: [], error: "Confirmá que querés reemplazar los datos actuales." };
  const fechaCorte = String(fd.get("fecha_corte") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) return { estado: "listo", resultados: [], error: "Indicá la fecha de corte." };

  const resultados: ResultadoImportacion[] = [];
  const tipos = new Set<string>();
  for (const a of archivos) {
    if (a.size > MAX_BYTES) { resultados.push({ ok: false, archivo: a.name, tipo: null, errores: ["El archivo supera los 4 MB."], advertencias: [] }); continue; }
    if (!/\.(csv|txt)$/i.test(a.name)) {
      resultados.push({ ok: false, archivo: a.name, tipo: null, advertencias: [],
        errores: ["Debe ser CSV. En Excel: Archivo › Guardar como › CSV (delimitado por punto y coma)."] });
      continue;
    }
    try {
      const r = await importarArchivo(a.name, await a.arrayBuffer(), s.uid, fechaCorte);
      if (r.tipo && tipos.has(r.tipo) && r.ok) r.advertencias.unshift("Se subió más de un archivo de este tipo: quedó el último.");
      if (r.tipo) tipos.add(r.tipo);
      resultados.push(r);
    } catch (e) {
      console.error("Error al importar", a.name, e);
      resultados.push({ ok: false, archivo: a.name, tipo: null, advertencias: [],
        errores: ["No se pudo guardar en la base. Los datos anteriores de este tipo no se modificaron."] });
    }
  }
  revalidatePath("/", "layout");
  return { estado: "listo", resultados };
}
