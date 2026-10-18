import "server-only";
import { requerirSesion } from "./auth";
import { leerFiltros, type SearchParams } from "./filtros";
import { opciones } from "./reportes";

/** Sesión + opciones de filtro + filtros activos, común a todos los reportes. */
export async function contextoReporte(spPromesa: Promise<SearchParams>) {
  const [sesion, op, sp] = await Promise.all([requerirSesion(), opciones(), spPromesa]);
  const f = leerFiltros(sp, op.anios);
  return { sesion, op, f, vacio: op.anios.length === 0 };
}
