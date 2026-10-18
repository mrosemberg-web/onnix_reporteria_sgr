export type Filtros = { anio: number; equipo: string; tipo: string; estado: string };
export type SearchParams = Record<string, string | string[] | undefined>;

export const EQUIPO_PROPIOS = "__propios";
export const EQUIPO_EXTERNOS = "__externos";

function uno(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function leerFiltros(sp: SearchParams, anios: number[]): Filtros {
  const actual = new Date().getFullYear();
  const pedido = Number(uno(sp.anio));
  const anio = anios.includes(pedido) ? pedido : anios[0] ?? actual;
  return { anio, equipo: uno(sp.equipo), tipo: uno(sp.tipo), estado: uno(sp.estado) };
}

export function aQuery(f: Filtros) {
  const p = new URLSearchParams();
  p.set("anio", String(f.anio));
  if (f.equipo) p.set("equipo", f.equipo);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.estado) p.set("estado", f.estado);
  return p.toString();
}
