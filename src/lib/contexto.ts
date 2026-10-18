import "server-only";
import { requerirSesion } from "./auth";
import { leerFiltros, type SearchParams } from "./filtros";
import { opciones } from "./reportes";

/** Sesión + opciones de filtro + filtros activos, común a todos los reportes. */
export async function contextoReporte(spPromesa: Promise<SearchParams>) {
  // La sesión primero: verifica la conexión antes de lanzar las consultas en paralelo.
  const sesion = await requerirSesion();
  const [op, sp] = await Promise.all([opciones(), spPromesa]);
  const f = leerFiltros(sp, op.anios);
  return { sesion, op, f, vacio: op.anios.length === 0 };
}
