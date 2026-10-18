"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth";
import { importarPlanilla } from "@/lib/importar";

export type EstadoCarga =
  | { estado: "inicial" }
  | { estado: "ok"; filas: number; advertencias: string[] }
  | { estado: "error"; errores: string[]; advertencias: string[] };

const MAX_BYTES = 4 * 1024 * 1024;

export async function cargarPlanilla(_: EstadoCarga, fd: FormData): Promise<EstadoCarga> {
  const s = await requerirAdmin();
  const archivo = fd.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { estado: "error", errores: ["Elegí un archivo CSV."], advertencias: [] };
  if (archivo.size > MAX_BYTES) return { estado: "error", errores: ["El archivo supera los 4 MB."], advertencias: [] };
  if (!/\.(csv|txt)$/i.test(archivo.name)) {
    return { estado: "error", errores: ["El archivo debe ser CSV. En Excel: Archivo › Guardar como › CSV (delimitado por punto y coma)."], advertencias: [] };
  }
  if (fd.get("confirmo") !== "si") return { estado: "error", errores: ["Confirmá que querés reemplazar los datos actuales."], advertencias: [] };

  try {
    const r = await importarPlanilla(archivo.name, await archivo.arrayBuffer(), s.uid);
    if (!r.ok) return { estado: "error", errores: r.errores, advertencias: r.advertencias };
    revalidatePath("/", "layout");
    return { estado: "ok", filas: r.filas, advertencias: r.advertencias };
  } catch (e) {
    console.error("Error al importar planilla", e);
    return { estado: "error", errores: ["No se pudo guardar la planilla en la base. Los datos anteriores no se modificaron."], advertencias: [] };
  }
}
