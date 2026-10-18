import "server-only";
import { transaccion } from "./db";
import { COLUMNAS_DB, decodificar, leerPlanilla } from "./planilla";

export type ResultadoImportacion =
  | { ok: true; filas: number; advertencias: string[]; cargaId: number }
  | { ok: false; errores: string[]; advertencias: string[] };

/** Reemplaza TODOS los requerimientos por el contenido de la planilla, en una sola transacción. */
export async function importarPlanilla(nombre: string, contenido: ArrayBuffer, usuarioId: number): Promise<ResultadoImportacion> {
  const { filas, advertencias, errores } = leerPlanilla(decodificar(contenido));
  if (errores.length) return { ok: false, errores, advertencias };
  if (filas.length === 0) return { ok: false, errores: ["La planilla no contiene requerimientos."], advertencias };

  const cargaId = await transaccion(async (tx) => {
    const [carga] = await tx<{ id: number }[]>`
      insert into cargas (archivo, filas, advertencias, cargado_por)
      values (${nombre}, ${filas.length}, ${tx.json(advertencias.slice(0, 500))}, ${usuarioId})
      returning id`;
    await tx`delete from requerimientos`;
    const conCarga = filas.map((f) => ({ ...f, carga_id: carga.id }));
    for (let i = 0; i < conCarga.length; i += 500) {
      await tx`insert into requerimientos ${tx(conCarga.slice(i, i + 500), [...COLUMNAS_DB, "carga_id"])}`;
    }
    return carga.id;
  });
  return { ok: true, filas: filas.length, advertencias, cargaId };
}
