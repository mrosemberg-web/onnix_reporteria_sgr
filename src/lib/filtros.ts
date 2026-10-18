// Filtros de los reportes. Todos admiten varios valores (?anio=2025&anio=2026&equipo=…).
export type Filtros = {
  anios: number[];
  equipos: string[];
  tipos: string[];
  estados: string[];
  servicios: string[];
};
export type SearchParams = Record<string, string | string[] | undefined>;

export const EQUIPO_PROPIOS = "__propios";
export const EQUIPO_EXTERNOS = "__externos";

/** Parámetro de URL -> clave en Filtros. */
export const PARAMETROS = {
  anio: "anios",
  equipo: "equipos",
  tipo: "tipos",
  estado: "estados",
  servicio: "servicios",
} as const satisfies Record<string, keyof Filtros>;

function lista(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return [...new Set(arr.map((x) => x.trim()).filter(Boolean))];
}

export function leerFiltros(sp: SearchParams, aniosDisponibles: number[]): Filtros {
  let anios = lista(sp.anio).map(Number).filter((a) => aniosDisponibles.includes(a));
  if (!anios.length) anios = [aniosDisponibles[0] ?? new Date().getFullYear()];
  return {
    anios: anios.sort((a, b) => a - b),
    equipos: lista(sp.equipo),
    tipos: lista(sp.tipo),
    estados: lista(sp.estado),
    servicios: lista(sp.servicio),
  };
}

/** URLSearchParams -> SearchParams conservando valores repetidos. */
export function desdeUrl(u: URLSearchParams): SearchParams {
  const sp: SearchParams = {};
  for (const k of new Set(u.keys())) sp[k] = u.getAll(k);
  return sp;
}

export function aQuery(f: Filtros) {
  const p = new URLSearchParams();
  for (const [param, clave] of Object.entries(PARAMETROS)) {
    for (const v of f[clave]) p.append(param, String(v));
  }
  return p.toString();
}

/** "2026", "2025 y 2026", "2024, 2025 y 2026". */
export function textoAnios(f: Filtros) {
  const a = f.anios.map(String);
  return a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a.at(-1)}`;
}

/** Descripción legible de los filtros activos (para el encabezado de los PDF). */
export function describirFiltros(
  f: Filtros,
  nombres: { estado: (c: string) => string; servicio: (c: string) => string },
): string {
  const equipo = (e: string) =>
    e === EQUIPO_PROPIOS ? "equipos de Onnix" : e === EQUIPO_EXTERNOS ? "equipos DITA y DPJ" : e;
  const partes = [`Año de implementación: ${textoAnios(f)}`];
  if (f.servicios.length) partes.push(`Servicio: ${f.servicios.map(nombres.servicio).join(", ")}`);
  if (f.equipos.length) partes.push(`Equipo: ${f.equipos.map(equipo).join(", ")}`);
  if (f.tipos.length) partes.push(`Tipo: ${f.tipos.join(", ")}`);
  if (f.estados.length) partes.push(`Estado: ${f.estados.map(nombres.estado).join(", ")}`);
  return partes.join(". ") + ".";
}
