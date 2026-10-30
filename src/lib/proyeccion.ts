import "server-only";
// Proyección de entregas por mes y por equipo (desarrollo y testing).
//
// Cada SGR entra con su monto completo en UN solo mes, según la fecha que manda:
//   1. Desarrollo y testing  -> fin de testing (desarrollo y testing van a ese mes).
//   2. Solo desarrollo       -> fin de desarrollo.
//   3. Solo testing (desarrollo del cliente) -> fin de testing.
// Se usa la entrega corregida por pausas, en días hábiles. Si el SGR todavía está en
// desarrollo y necesita testing, el fin de testing se estima: entrega de desarrollo +
// días hábiles de testing (importe de testing ÷ tarifa ÷ 8 h).
// El importe de desarrollo se asigna al equipo de Desarrollo y el de testing al de Testing.
import { sql } from "./db";
import { aplicarFiltros, cargarSeguimiento, type FiltrosSeguimiento } from "./seguimiento";
import { aIso, fechaMs, sumarHabiles, type Analisis } from "./seguimiento-calculo";

import { TARIFA_DESA_HORA, TARIFA_TEST_HORA } from "./reportes";
export { TARIFA_TEST_HORA };

export type Escenario = 1 | 2 | 3;
export const ESCENARIOS: Record<Escenario, string> = {
  1: "Desarrollo y testing",
  2: "Solo desarrollo",
  3: "Solo testing (desarrollo del cliente)",
};

export type Destino = "entregado" | "proyectado" | "vencido" | "sin_fecha";

export type ItemProyeccion = {
  id_req: string;
  asunto: string | null;
  escenario: Escenario;
  origen: "en_curso" | "implementado";
  situacion: string;            // fase y estado actual, en texto
  responsable: string;
  usuarios: string[];
  lider: string | null;
  tipo: string | null;
  fecha: string | null;         // fecha que manda
  base: "fin_testing" | "fin_desarrollo";
  estimada: boolean;            // fin de testing estimado por el sistema
  destino: Destino;
  mes: string | null;           // 'AAAA-MM' o 'siguiente'
  desa: number;
  test: number;
  /** Desestimado por el cliente (cuenta como entregado). */
  desestimado: boolean;
  /** Presupuesto × tarifa menos el importe de la planilla, si es positivo. */
  descuento: number | null;
  /** Pasó al mes siguiente por la fecha de corte del mes. */
  corrido: boolean;
  /** posterior: su fecha es posterior al corte. mes_cerrado: el corte ya pasó y no se entregó. */
  motivoCorrido?: "posterior" | "mes_cerrado";
};

const escenarioDe = (desa: number, test: number): Escenario | null =>
  desa > 0 && test > 0 ? 1 : desa > 0 ? 2 : test > 0 ? 3 : null;

function clasificar(fecha: string | null, corte: string, anioCorte: number): { destino: Destino; mes: string | null } {
  if (!fecha) return { destino: "sin_fecha", mes: null };
  if (fecha < corte) return { destino: "vencido", mes: null };
  return { destino: "proyectado", mes: +fecha.slice(0, 4) > anioCorte ? "siguiente" : fecha.slice(0, 7) };
}

function desdeEnCurso(a: Analisis, corte: string, anioCorte: number, fer: Set<string>): ItemProyeccion | null {
  const desa = a.importe_desa ?? 0, test = a.importe_test ?? 0;
  const esc = escenarioDe(desa, test);
  if (!esc || a.etapa === "sin_asignacion") return null;
  const base = esc === 2 ? "fin_desarrollo" : "fin_testing";
  const comun = {
    id_req: a.id_req, asunto: a.asunto, escenario: esc, origen: "en_curso" as const,
    situacion: `${a.fase === "desa" ? "Desarrollo" : "Testing"}: ${a.estado ?? ""}`, responsable: a.nombre ?? a.usuario,
    usuarios: [a.usuario], lider: a.lider, tipo: a.tipo_servicio, base: base as ItemProyeccion["base"], desa, test,
    desestimado: false, descuento: null, corrido: false,
  };
  const finalizado = a.etapa === "finalizado";
  const mesCorte = corte.slice(0, 7);

  // La fase que manda ya terminó: entregado en el mes de su fecha de estado.
  const fasePropia = base === "fin_desarrollo" ? "desa" : "test";
  if (finalizado && a.fase === fasePropia) {
    const f = a.fecha_estado;
    if (f && f.slice(0, 7) === mesCorte && f <= corte) return { ...comun, fecha: f, estimada: false, destino: "entregado", mes: mesCorte };
    return null; // entregado en un mes anterior: no entra en la proyección
  }
  if (a.situacion === "replanificacion") return { ...comun, fecha: null, estimada: false, destino: "sin_fecha", mes: null };

  // Fecha que manda.
  let fecha: string | null;
  let estimada = false;
  if (a.fase === fasePropia) {
    fecha = a.entregaCorregida;
  } else {
    // En desarrollo pero manda el fin de testing: se estima.
    const finDesa = finalizado ? a.fecha_estado : a.entregaCorregida;
    const ms = fechaMs(finDesa);
    fecha = ms == null ? null : aIso(sumarHabiles(ms, Math.max(1, Math.ceil(test / TARIFA_TEST_HORA / 8)), fer));
    estimada = fecha != null;
  }
  return { ...comun, fecha, estimada, ...clasificar(fecha, corte, anioCorte) };
}

type FilaHistorica = {
  id_req: string; asunto: string | null; servicio: string; estado: string | null; asignado_a: string | null;
  asignado_testing: string | null; tipo_requerimiento: string | null; desa: number; test: number; fecha_fin: string;
  desestimado: boolean; descuento: number;
};

export type Proyeccion = Awaited<ReturnType<typeof proyeccion>>;

function finDeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function mesSiguiente(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * hasta: fecha de corte del mes. Por defecto, el último día del mes en curso.
 *  - Lo que se estima entregar en ese mes pero después del corte pasa al mes siguiente.
 *  - Si el corte ya pasó (hoy es posterior), el mes está cerrado: lo que quedó por entregar
 *    en ese mes también pasa al siguiente. Lo ya entregado queda en el mes.
 */
export async function proyeccion(f: FiltrosSeguimiento, { hasta: hastaPedido }: { hasta?: string } = {}) {
  const datos = await cargarSeguimiento();
  const corte = [datos.corte.desa, datos.corte.test].sort().at(-1)!;
  const anioCorte = +corte.slice(0, 4);
  const inicioMes = `${corte.slice(0, 7)}-01`;

  const enCurso = aplicarFiltros(datos.analisis, { ...f, etapas: [], situaciones: [] })
    .map((a) => desdeEnCurso(a, corte, anioCorte, datos.feriados))
    .filter((x): x is ItemProyeccion => x != null);

  // Implementados cuya fecha que manda cayó en el mes actual (hasta la fecha de corte).
  const historicos = await sql<FilaHistorica[]>`
    select id_req, asunto, servicio, estado, asignado_a, asignado_testing, tipo_requerimiento,
           (case when aplica_desa then importe_desa else 0 end)::float8 as desa,
           (case when aplica_test then importe_test else 0 end)::float8 as test,
           case when servicio = 'solo_desa' then fecha_fin_desa else fecha_fin_testing end as fecha_fin,
           desestimado,
           greatest((case when aplica_desa then horas_presu_desa * ${TARIFA_DESA_HORA} - importe_desa else 0 end)
                  + (case when aplica_test then horas_presu_test * ${TARIFA_TEST_HORA} - importe_test else 0 end), 0)::float8 as descuento
    from v_requerimientos
    where entregado and servicio in ('desa_test', 'solo_desa', 'solo_test')
      and (case when servicio = 'solo_desa' then fecha_fin_desa else fecha_fin_testing end) between ${inicioMes} and ${corte}`;
  const lideres = new Map(datos.analisis.map((a) => [a.usuario, a.lider]));
  const vistos = new Set(enCurso.map((i) => i.id_req));
  const implementados: ItemProyeccion[] = historicos
    .filter((h) => !vistos.has(h.id_req))
    .map((h) => {
      const esc: Escenario = h.servicio === "desa_test" ? 1 : h.servicio === "solo_desa" ? 2 : 3;
      const usuarios = [h.asignado_a, h.asignado_testing].filter((x): x is string => !!x);
      return {
        id_req: h.id_req, asunto: h.asunto, escenario: esc, origen: "implementado" as const,
        situacion: h.desestimado ? "Desestimado por el cliente (cuenta como entregado)" : "Implementado",
        desestimado: h.desestimado, descuento: h.desestimado && h.descuento > 0 ? h.descuento : null, corrido: false,
        responsable: usuarios.join(" / "), usuarios, lider: usuarios.map((u) => lideres.get(u)).find(Boolean) ?? null,
        tipo: h.tipo_requerimiento, fecha: h.fecha_fin, base: esc === 2 ? "fin_desarrollo" as const : "fin_testing" as const,
        estimada: false, destino: "entregado" as const, mes: corte.slice(0, 7), desa: h.desa, test: h.test,
      };
    })
    .filter((i) =>
      (!f.personas.length || i.usuarios.some((u) => f.personas.includes(u))) &&
      (!f.lideres.length || (i.lider != null && f.lideres.includes(i.lider))) &&
      (!f.servicios.length || (i.tipo != null && f.servicios.includes(i.tipo))));

  // Fecha de corte del mes: entre el inicio del mes en curso y el 31 de diciembre.
  const finAnio = `${anioCorte}-12-31`;
  const hasta = hastaPedido && /^\d{4}-\d{2}-\d{2}$/.test(hastaPedido) && hastaPedido >= inicioMes && hastaPedido <= finAnio
    ? hastaPedido : finDeMes(corte.slice(0, 7));
  const mesHasta = hasta.slice(0, 7);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "America/Asuncion" }).format(new Date());
  const mesCerrado = hasta < hoy;
  for (const i of enCurso) {
    if (i.destino === "proyectado" && i.mes === mesHasta && i.fecha && (mesCerrado || i.fecha > hasta)) {
      i.motivoCorrido = i.fecha > hasta ? "posterior" : "mes_cerrado";
      const sig = mesSiguiente(mesHasta);
      i.mes = +sig.slice(0, 4) > anioCorte ? "siguiente" : sig;
      i.corrido = true;
    }
  }
  const items = [...implementados, ...enCurso];

  // Columnas: mes actual hasta diciembre, y el año siguiente.
  const meses: string[] = [];
  for (let m = +corte.slice(5, 7); m <= 12; m++) meses.push(`${anioCorte}-${String(m).padStart(2, "0")}`);
  const columnas = [...meses, "siguiente"];

  const suma = (l: ItemProyeccion[], k: "desa" | "test") => l.reduce((s, i) => s + i[k], 0);
  const celda = (destino: Destino, mes?: string) => items.filter((i) => i.destino === destino && (mes === undefined || i.mes === mes));
  const matriz = columnas.map((c) => {
    const ent = c === meses[0] ? celda("entregado", c) : [];
    const pro = celda("proyectado", c);
    return {
      clave: c, entregados: ent.length, proyectados: pro.length,
      desa: { entregado: suma(ent, "desa"), proyectado: suma(pro, "desa") },
      test: { entregado: suma(ent, "test"), proyectado: suma(pro, "test") },
      estimado: suma(pro.filter((i) => i.estimada), "desa") + suma(pro.filter((i) => i.estimada), "test"),
    };
  });
  const bloque = (d: Destino) => { const l = celda(d); return { sgr: l.length, desa: suma(l, "desa"), test: suma(l, "test") }; };
  const corridos = enCurso.filter((i) => i.corrido);
  return {
    corte, anioCorte, meses, columnas, matriz, vencidos: bloque("vencido"), sinFecha: bloque("sin_fecha"), items,
    cargas: datos.cargas, analisis: datos.analisis,
    hasta, hastaPorDefecto: hasta === finDeMes(corte.slice(0, 7)), limites: { min: inicioMes, max: finAnio }, mesCerrado, hoy,
    corridos: { sgr: corridos.length, monto: corridos.reduce((s, i) => s + i.desa + i.test, 0), de: mesHasta, a: mesSiguiente(mesHasta) },
  };
}
