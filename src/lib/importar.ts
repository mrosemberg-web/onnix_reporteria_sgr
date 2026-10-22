import "server-only";
import { transaccion } from "./db";
import { COLUMNAS_DB, decodificar, leerPlanilla } from "./planilla";
import {
  COLUMNAS_SEGUIMIENTO, detectarTipo, leerSeguimiento, matrizCsv, NOMBRE_TIPO, type TipoPlanilla,
} from "./planilla-seguimiento";

export type ResultadoImportacion =
  | { ok: true; archivo: string; tipo: TipoPlanilla; filas: number; advertencias: string[]; cargaId: number }
  | { ok: false; archivo: string; tipo: TipoPlanilla | null; errores: string[]; advertencias: string[] };

/**
 * Importa un archivo según su tipo, que se reconoce por los encabezados.
 * Cada tipo reemplaza solo sus propios datos, en una única transacción:
 *  - Facturación por período: todos los requerimientos históricos.
 *  - Seguimiento de desarrollo / de testing: los SGR en curso de esa mirada.
 */
export async function importarArchivo(
  nombre: string, contenido: ArrayBuffer, usuarioId: number, fechaCorte: string,
): Promise<ResultadoImportacion> {
  const txt = decodificar(contenido);
  const tipo = detectarTipo(matrizCsv(txt.split(/\r?\n/, 1)[0] ?? "")[0] ?? []);
  if (!tipo) {
    return { ok: false, archivo: nombre, tipo: null, advertencias: [],
      errores: ["No se reconoce la planilla. Se esperan los encabezados de «Facturación por período», «Seguimiento desarrollo» o «Seguimiento testing»."] };
  }

  if (tipo === "facturacion") {
    const { filas, advertencias, errores } = leerPlanilla(txt);
    if (errores.length) return { ok: false, archivo: nombre, tipo, errores, advertencias };
    if (!filas.length) return { ok: false, archivo: nombre, tipo, errores: ["La planilla no contiene requerimientos."], advertencias };
    const cargaId = await transaccion(async (tx) => {
      const [carga] = await tx<{ id: number }[]>`
        insert into cargas (archivo, filas, advertencias, cargado_por, tipo, fecha_corte)
        values (${nombre}, ${filas.length}, ${tx.json(advertencias.slice(0, 500))}, ${usuarioId}, ${tipo}, ${fechaCorte})
        returning id`;
      await tx`delete from requerimientos`;
      const conCarga = filas.map((f) => ({ ...f, carga_id: carga.id }));
      for (let i = 0; i < conCarga.length; i += 500) {
        await tx`insert into requerimientos ${tx(conCarga.slice(i, i + 500), [...COLUMNAS_DB, "carga_id"])}`;
      }
      return carga.id;
    });
    return { ok: true, archivo: nombre, tipo, filas: filas.length, advertencias, cargaId };
  }

  const fase = tipo === "seguimiento_desa" ? "desa" : "test";
  const { filas, advertencias, errores } = leerSeguimiento(txt, fase);
  if (errores.length) return { ok: false, archivo: nombre, tipo, errores, advertencias };
  if (!filas.length) return { ok: false, archivo: nombre, tipo, errores: [`La planilla de ${NOMBRE_TIPO[tipo].toLowerCase()} no tiene filas.`], advertencias };
  const cargaId = await transaccion(async (tx) => {
    const [carga] = await tx<{ id: number }[]>`
      insert into cargas (archivo, filas, advertencias, cargado_por, tipo, fecha_corte)
      values (${nombre}, ${filas.length}, ${tx.json(advertencias.slice(0, 500))}, ${usuarioId}, ${tipo}, ${fechaCorte})
      returning id`;
    await tx`delete from seguimiento where fase = ${fase}`;
    const conCarga = filas.map((f) => ({ ...f, carga_id: carga.id }));
    await tx`insert into seguimiento ${tx(conCarga, [...COLUMNAS_SEGUIMIENTO, "carga_id"])}`;
    return carga.id;
  });
  return { ok: true, archivo: nombre, tipo, filas: filas.length, advertencias, cargaId };
}
