import "server-only";
import { sql } from "./db";
import type { SearchParams } from "./filtros";
import { COLUMNAS_SEGUIMIENTO, type FilaSeguimiento } from "./planilla-seguimiento";
import { analizar, lideresDe, type Analisis } from "./seguimiento-calculo";

export type FiltrosSeguimiento = { fases: string[]; lideres: string[]; personas: string[]; servicios: string[]; etapas: string[]; situaciones: string[] };
export const PARAMS_SEGUIMIENTO = { fase: "fases", lider: "lideres", persona: "personas", tservicio: "servicios", etapa: "etapas", situacion: "situaciones" } as const;

function lista(v: string | string[] | undefined) {
  return [...new Set((Array.isArray(v) ? v : v ? [v] : []).filter(Boolean))];
}

export function leerFiltrosSeguimiento(sp: SearchParams): FiltrosSeguimiento {
  const f = {} as FiltrosSeguimiento;
  for (const [p, k] of Object.entries(PARAMS_SEGUIMIENTO)) f[k] = lista(sp[p]);
  return f;
}

function hoyIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "America/Asuncion" }).format(new Date());
}

export type CargaSeguimiento = { tipo: string; archivo: string; fecha_corte: string; cargado_en: Date };

/** Lee las dos planillas en curso y analiza cada SGR contra la fecha de corte de su carga. */
export async function cargarSeguimiento() {
  const [filas, cargas] = await Promise.all([
    sql<FilaSeguimiento[]>`select ${sql(COLUMNAS_SEGUIMIENTO)} from seguimiento order by fase, usuario, id_req`,
    sql<CargaSeguimiento[]>`
      select distinct on (tipo) tipo, archivo, coalesce(fecha_corte, (cargado_en at time zone 'America/Asuncion')::date) as fecha_corte, cargado_en
      from cargas where tipo in ('seguimiento_desa', 'seguimiento_test') order by tipo, id desc`,
  ]);
  const corte = {
    desa: cargas.find((c) => c.tipo === "seguimiento_desa")?.fecha_corte ?? hoyIso(),
    test: cargas.find((c) => c.tipo === "seguimiento_test")?.fecha_corte ?? hoyIso(),
  };
  const analisis: Analisis[] = [];
  for (const fase of ["desa", "test"] as const) {
    const deFase = filas.filter((f) => f.fase === fase);
    const lideres = lideresDe(deFase);
    for (const f of deFase) analisis.push(analizar(f, corte[fase], lideres));
  }
  return { analisis, cargas, corte };
}

export function aplicarFiltros(items: Analisis[], f: FiltrosSeguimiento) {
  return items.filter((a) =>
    (!f.fases.length || f.fases.includes(a.fase)) &&
    (!f.lideres.length || f.lideres.includes(a.lider)) &&
    (!f.personas.length || f.personas.includes(a.usuario)) &&
    (!f.servicios.length || (a.tipo_servicio != null && f.servicios.includes(a.tipo_servicio))) &&
    (!f.etapas.length || f.etapas.includes(a.etapa)) &&
    (!f.situaciones.length || f.situaciones.includes(a.situacion)));
}

export function opcionesSeguimiento(items: Analisis[]) {
  const unicos = <T,>(v: T[]) => [...new Set(v)];
  const nombres = new Map(items.map((a) => [a.usuario, a.nombre ?? a.usuario]));
  return {
    lideres: unicos(items.map((a) => a.lider)).sort(),
    personas: unicos(items.map((a) => a.usuario)).sort((a, b) => (nombres.get(a) ?? a).localeCompare(nombres.get(b) ?? b, "es")),
    nombres,
    servicios: unicos(items.map((a) => a.tipo_servicio).filter((x): x is string => !!x)).sort(),
  };
}
