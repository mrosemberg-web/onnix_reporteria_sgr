import "server-only";
// Horas trabajadas en el período por persona (planilla «Resumen de horas»).
// Reemplaza a las "horas cargadas ayer" de las planillas de seguimiento.
import { sql } from "./db";
import { MESES_LARGOS } from "./formato";
import type { FiltrosSeguimiento } from "./seguimiento";
import type { Analisis } from "./seguimiento-calculo";

export type HorasPersona = {
  usuario: string;
  fase: "desa" | "test";
  equipo: string | null;
  lider: string;
  periodo: string | null;
  /** null: la persona no cargó horas en el período. */
  trabajadas: number | null;
  potencial: number;
  /** potencial − trabajadas (se recalcula; el vacío de la planilla cuenta como 0 trabajadas). */
  diferencia: number;
  dias: number | null;
};

export type ResumenHoras = { personas: number; trabajadas: number; potencial: number; carga: number | null; sinCarga: number; debajo: number };

/** Lee la planilla de horas y ubica a cada persona en desarrollo o testing. */
export async function cargarHoras(analisis: Analisis[]) {
  const [filas, [carga]] = await Promise.all([
    sql<{ usuario: string; equipo: string | null; team_leader: string | null; periodo: string | null;
          horas_trabajadas: number | null; dias_habiles: number | null; potencial: number | null }[]>`
      select usuario, equipo, team_leader, periodo, horas_trabajadas, dias_habiles, potencial from horas_periodo`,
    sql<{ archivo: string; cargado_en: Date }[]>`
      select archivo, cargado_en from cargas where tipo = 'resumen_horas' order by id desc limit 1`,
  ]);
  // La fase sale de la planilla de seguimiento en la que figura la persona; si no figura, del código de equipo.
  const faseDe = new Map<string, "desa" | "test">();
  for (const a of analisis) if (!faseDe.has(a.usuario)) faseDe.set(a.usuario, a.fase);
  const lideres = new Set(filas.map((f) => f.team_leader).filter(Boolean));
  const liderSeg = new Map(analisis.map((a) => [a.usuario, a.lider]));
  const personas: HorasPersona[] = filas.map((f) => {
    const trabajadas = f.horas_trabajadas;
    const potencial = f.potencial ?? 0;
    return {
      usuario: f.usuario,
      fase: faseDe.get(f.usuario) ?? (/^qa|test/i.test(f.equipo ?? "") ? "test" : "desa"),
      equipo: f.equipo,
      lider: f.team_leader ?? liderSeg.get(f.usuario) ?? (lideres.has(f.usuario) ? f.usuario : "Sin líder"),
      periodo: f.periodo,
      trabajadas,
      potencial,
      diferencia: potencial - (trabajadas ?? 0),
      dias: f.dias_habiles,
    };
  });
  const periodos = personas.map((p) => p.periodo).filter((x): x is string => !!x).sort();
  const periodo = periodos.at(-1) ?? null;
  return { personas, periodo, nombrePeriodo: nombrePeriodo(periodo), carga: carga ?? null };
}

export function nombrePeriodo(p: string | null) {
  if (!p) return "el período";
  const [a, m] = p.split("/").map(Number);
  return `${MESES_LARGOS[m - 1] ?? p} ${a}`;
}

export function filtrarHoras(l: HorasPersona[], f: FiltrosSeguimiento, fase?: "desa" | "test") {
  return l.filter((p) =>
    (!fase || p.fase === fase) &&
    (!f.fases.length || f.fases.includes(p.fase)) &&
    (!f.lideres.length || f.lideres.includes(p.lider)) &&
    (!f.personas.length || f.personas.includes(p.usuario)));
}

export function resumirHoras(l: HorasPersona[]): ResumenHoras {
  const trabajadas = l.reduce((s, p) => s + (p.trabajadas ?? 0), 0);
  const potencial = l.reduce((s, p) => s + p.potencial, 0);
  return {
    personas: l.length, trabajadas, potencial, carga: potencial ? trabajadas / potencial : null,
    sinCarga: l.filter((p) => !p.trabajadas).length, debajo: l.filter((p) => p.diferencia > 0).length,
  };
}
