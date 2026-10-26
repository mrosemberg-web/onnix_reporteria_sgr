import "server-only";
import { sql } from "./db";
import { EQUIPO_EXTERNOS, EQUIPO_PROPIOS, type Filtros } from "./filtros";
import { ORDEN_SERVICIOS } from "./servicios";
import { claveDestino, construirMeses, type Mes } from "./meses";

export type Fase = "desa" | "test";

/** Tarifas por hora de la planilla (Gs.), para estimar descuentos de los desestimados. */
export const TARIFA_DESA_HORA = 240_000;
export const TARIFA_TEST_HORA = 200_000;

/** Tolerancia para considerar un desvío "leve" (10 % sobre lo presupuestado). */
export const TOLERANCIA = 0.1;

// Filtros con varios valores: dentro de un mismo filtro es "o", entre filtros es "y".
const filtro = (f: Filtros) => {
  const eq = [];
  if (f.equipos.includes(EQUIPO_PROPIOS)) eq.push(sql`not equipo_externo`);
  if (f.equipos.includes(EQUIPO_EXTERNOS)) eq.push(sql`equipo_externo`);
  const nombres = f.equipos.filter((e) => e !== EQUIPO_PROPIOS && e !== EQUIPO_EXTERNOS);
  if (nombres.length) eq.push(sql`equipo in ${sql(nombres)}`);
  const equipos = eq.length ? eq.reduce((a, b) => sql`${a} or ${b}`) : null;
  return sql`
    extract(year from implementacion)::int in ${sql(f.anios)}
    ${equipos ? sql`and (${equipos})` : sql``}
    ${f.tipos.length ? sql`and tipo_requerimiento in ${sql(f.tipos)}` : sql``}
    ${f.estados.length ? sql`and estado in ${sql(f.estados)}` : sql``}
    ${f.servicios.length ? sql`and servicio in ${sql(f.servicios)}` : sql``}`;
};

// ---------------------------------------------------------------------------
// Agregado estándar por fase. "real_reg"/"presu_reg" solo consideran SGR con
// horas cargadas, para que los SGR sin registro de horas no inflen el índice.
// ---------------------------------------------------------------------------
const aggFase = () => sql`
  count(*) as sgr,
  count(*) filter (where entregado) as entregados,
  count(*) filter (where desestimado) as desestimados,
  count(*) filter (where servicio = 'solo_test') as solo_test,
  count(*) filter (where servicio = 'solo_test' and entregado) as solo_test_entregados,
  coalesce(sum(horas_real), 0)::float8 as horas_real,
  coalesce(sum(horas_presu), 0)::float8 as horas_presu,
  coalesce(sum(horas_real) filter (where horas_real > 0), 0)::float8 as real_reg,
  coalesce(sum(horas_presu) filter (where horas_real > 0), 0)::float8 as presu_reg,
  count(*) filter (where horas_real > 0 and horas_real <= horas_presu) as dentro,
  count(*) filter (where horas_real > horas_presu and horas_real <= horas_presu * ${1 + TOLERANCIA}) as leve,
  count(*) filter (where horas_real > 0 and horas_real > horas_presu * ${1 + TOLERANCIA}) as sobre,
  count(*) filter (where horas_real = 0) as sin_registro,
  coalesce(sum(greatest(horas_real - horas_presu, 0)) filter (where horas_real > 0), 0)::float8 as horas_excedidas,
  coalesce(sum(greatest(horas_presu - horas_real, 0)) filter (where horas_real > 0), 0)::float8 as horas_ahorradas,
  coalesce(sum(horas_pausadas), 0)::float8 as horas_pausadas,
  coalesce(sum(devoluciones), 0)::int as devoluciones,
  count(*) filter (where devoluciones > 0) as sgr_con_devolucion,
  percentile_cont(0.5) within group (order by dias_hab)::float8 as dias_hab_med,
  percentile_cont(0.5) within group (order by dias_netos)::float8 as dias_netos_med,
  coalesce(sum(dias_hab), 0)::float8 as dias_hab_sum,
  coalesce(sum(least(horas_pausadas / 8.0, dias_hab)) filter (where dias_hab is not null), 0)::float8 as dias_pausa_sum,
  coalesce(sum(importe), 0)::float8 as importe`;

export type AggFase = {
  sgr: number; entregados: number; desestimados: number; solo_test: number; solo_test_entregados: number; horas_real: number; horas_presu: number; real_reg: number; presu_reg: number;
  dentro: number; leve: number; sobre: number; sin_registro: number;
  horas_excedidas: number; horas_ahorradas: number; horas_pausadas: number;
  devoluciones: number; sgr_con_devolucion: number;
  dias_hab_med: number | null; dias_netos_med: number | null; dias_hab_sum: number; dias_pausa_sum: number;
  importe: number;
};

export const AGG_VACIO: AggFase = {
  sgr: 0, entregados: 0, desestimados: 0, solo_test: 0, solo_test_entregados: 0, horas_real: 0, horas_presu: 0, real_reg: 0, presu_reg: 0, dentro: 0, leve: 0, sobre: 0,
  sin_registro: 0, horas_excedidas: 0, horas_ahorradas: 0, horas_pausadas: 0, devoluciones: 0,
  sgr_con_devolucion: 0, dias_hab_med: null, dias_netos_med: null, dias_hab_sum: 0, dias_pausa_sum: 0, importe: 0,
};

/** Índice de cumplimiento: horas presupuestadas ÷ horas trabajadas (≥ 1 = dentro de presupuesto). */
export const indice = (a: { presu_reg: number; real_reg: number }) => (a.real_reg > 0 ? a.presu_reg / a.real_reg : null);
export const pctPausa = (a: AggFase) => (a.dias_hab_sum > 0 ? a.dias_pausa_sum / a.dias_hab_sum : null);

// ---------------------------------------------------------------------------

export async function opciones() {
  const [anios, equipos, tipos, estados, servicios, [carga]] = await Promise.all([
    sql<{ anio: number }[]>`select distinct extract(year from implementacion)::int as anio from requerimientos where implementacion is not null order by 1 desc`,
    sql<{ v: string }[]>`select distinct equipo as v from requerimientos where equipo is not null order by 1`,
    sql<{ v: string }[]>`select distinct tipo_requerimiento as v from requerimientos where tipo_requerimiento is not null order by 1`,
    sql<{ v: string }[]>`select distinct estado as v from requerimientos where estado is not null order by 1`,
    sql<{ v: string }[]>`select distinct servicio as v from v_requerimientos`,
    sql<{ archivo: string; filas: number; cargado_en: Date; nombre: string | null }[]>`
      select c.archivo, c.filas, c.cargado_en, u.nombre from cargas c left join usuarios u on u.id = c.cargado_por
      where c.tipo = 'facturacion' order by c.id desc limit 1`,
  ]);
  return {
    anios: anios.map((r) => r.anio),
    equipos: equipos.map((r) => r.v),
    tipos: tipos.map((r) => r.v),
    estados: estados.map((r) => r.v),
    servicios: ORDEN_SERVICIOS.filter((x) => servicios.some((r) => r.v === x)),
    ultimaCarga: carga ?? null,
  };
}

export type KpisReq = {
  sgr: number; entregados: number; sgr_pap: number; desestimados: number;
  desarrollos_entregados: number; testing_entregados: number; testing_onnix: number; testing_cliente: number;
  desa_sin_presu: number; horas_desa_sin_presu: number;
  horas_desestimados: number; facturado_desestimados: number; descuento_desestimados: number; devoluciones_sin_pausa: number;
  facturado: number; facturado_desa: number; facturado_test: number; facturado_test_cliente: number;
  pendiente_facturar: number; sgr_pendiente_facturar: number; devoluciones: number; sgr_con_devolucion: number;
  lead_hab_med: number | null; lead_neto_med: number | null; horas_pausadas: number;
  horas_real_total: number; horas_presu_total: number;
};

export type MesResumen = Mes & {
  desarrollos: number; solo_test: number; acumulado_desa: number;
  facturado: number; horas_presu: number; horas_real: number;
};

export async function resumen(f: Filtros) {
  const [[kpis], fases, porMes] = await Promise.all([
    sql<KpisReq[]>`
      select count(*) as sgr,
             count(*) filter (where entregado) as entregados,
             count(*) filter (where upper(trim(estado)) = 'PAP') as sgr_pap,
             count(*) filter (where desestimado) as desestimados,
             count(*) filter (where entregado and aplica_desa) as desarrollos_entregados,
             count(*) filter (where entregado and aplica_test) as testing_entregados,
             count(*) filter (where entregado and servicio = 'desa_test') as testing_onnix,
             count(*) filter (where entregado and servicio = 'solo_test') as testing_cliente,
             count(*) filter (where desa_sin_presu) as desa_sin_presu,
             coalesce(sum(horas_desa) filter (where desa_sin_presu), 0)::float8 as horas_desa_sin_presu,
             coalesce(sum(horas_real_total) filter (where desestimado), 0)::float8 as horas_desestimados,
             coalesce(sum(total_facturar) filter (where desestimado), 0)::float8 as facturado_desestimados,
             -- Descuento: presupuesto × tarifa menos el importe de la planilla.
             coalesce(sum(greatest(
               (case when aplica_desa then horas_presu_desa * ${TARIFA_DESA_HORA} - importe_desa else 0 end)
             + (case when aplica_test then horas_presu_test * ${TARIFA_TEST_HORA} - importe_test else 0 end), 0)) filter (where desestimado), 0)::float8 as descuento_desestimados,
             count(*) filter (where devoluciones > 0 and horas_pausadas = 0) as devoluciones_sin_pausa,
             coalesce(sum(total_facturar), 0)::float8 as facturado,
             coalesce(sum(importe_desa) filter (where aplica_desa), 0)::float8 as facturado_desa,
             coalesce(sum(importe_test) filter (where aplica_test), 0)::float8 as facturado_test,
             coalesce(sum(importe_test) filter (where servicio = 'solo_test'), 0)::float8 as facturado_test_cliente,
             coalesce(sum(total_facturar) filter (where fecha_facturacion is null), 0)::float8 as pendiente_facturar,
             count(*) filter (where fecha_facturacion is null) as sgr_pendiente_facturar,
             coalesce(sum(devoluciones), 0)::int as devoluciones,
             count(*) filter (where devoluciones > 0) as sgr_con_devolucion,
             percentile_cont(0.5) within group (order by lead_hab)::float8 as lead_hab_med,
             percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med,
             coalesce(sum(horas_pausadas), 0)::float8 as horas_pausadas,
             coalesce(sum(horas_real_total), 0)::float8 as horas_real_total,
             coalesce(sum(horas_presu_total), 0)::float8 as horas_presu_total
      from v_requerimientos where ${filtro(f)}`,
    sql<(AggFase & { fase: Fase })[]>`select fase, ${aggFase()} from v_fases where ${filtro(f)} group by fase`,
    sql<{ clave: string; desarrollos: number; solo_test: number; facturado: number; horas_presu: number; horas_real: number }[]>`
      select to_char(implementacion, 'YYYY-MM') as clave,
             count(*) filter (where entregado and aplica_desa) as desarrollos,
             count(*) filter (where entregado and servicio = 'solo_test') as solo_test,
             coalesce(sum(total_facturar), 0)::float8 as facturado,
             coalesce(sum(horas_presu_total), 0)::float8 as horas_presu,
             coalesce(sum(horas_real_total), 0)::float8 as horas_real
      from v_requerimientos where ${filtro(f)} and implementacion is not null group by 1`,
  ]);
  const { meses, enCurso } = construirMeses(f.anios, porMes.map((r) => r.clave));
  const datos = new Map(porMes.map((r) => [r.clave, r]));
  let acumulado = 0, anioActual = 0;
  const mensual: MesResumen[] = meses.map((m) => {
    const d = datos.get(m.clave);
    if (m.anio !== anioActual) { anioActual = m.anio; acumulado = 0; } // el acumulado es por año
    acumulado += d?.desarrollos ?? 0;
    return { ...m, desarrollos: d?.desarrollos ?? 0, solo_test: d?.solo_test ?? 0, acumulado_desa: acumulado,
             facturado: d?.facturado ?? 0, horas_presu: d?.horas_presu ?? 0, horas_real: d?.horas_real ?? 0 };
  });
  const porFase = (x: Fase) => fases.find((r) => r.fase === x) ?? { ...AGG_VACIO, fase: x };
  return { kpis, desa: porFase("desa"), test: porFase("test"), mensual, mesEnCurso: enCurso };
}

export type FilaResponsable = AggFase & { responsable: string; meses_activos: number };
export type MesFase = Mes & { sgr: number; solo_test: number; horas_real: number; horas_presu: number };

export async function fase(fz: Fase, f: Filtros) {
  const [[total], responsables, porMes, puntos, [sinPresu]] = await Promise.all([
    sql<AggFase[]>`select ${aggFase()} from v_fases where fase = ${fz} and ${filtro(f)}`,
    sql<FilaResponsable[]>`
      select responsable, ${aggFase()},
             count(distinct date_trunc('month', fecha_fin)) as meses_activos
      from v_fases where fase = ${fz} and ${filtro(f)}
      group by responsable order by count(*) filter (where entregado) desc, count(*) desc, responsable`,
    // Por mes de FIN de la fase.
    sql<{ clave: string; sgr: number; solo_test: number; horas_real: number; horas_presu: number }[]>`
      select to_char(fecha_fin, 'YYYY-MM') as clave, count(*) as sgr,
             count(*) filter (where servicio = 'solo_test') as solo_test,
             coalesce(sum(horas_real), 0)::float8 as horas_real, coalesce(sum(horas_presu), 0)::float8 as horas_presu
      from v_fases where fase = ${fz} and ${filtro(f)} and fecha_fin is not null group by 1`,
    sql<{ id_req: string; responsable: string; horas_presu: number; horas_real: number; asunto: string | null }[]>`
      select id_req, responsable, horas_presu::float8, horas_real::float8, asunto
      from v_fases where fase = ${fz} and ${filtro(f)} and (horas_real > 0 or horas_presu > 0)`,
    // Horas de desarrollo cargadas por equipos de Onnix SIN presupuesto: no cuentan como desarrollo.
    sql<{ sgr: number; horas: number }[]>`
      select count(*) as sgr, coalesce(sum(horas_desa), 0)::float8 as horas
      from v_requerimientos where desa_sin_presu and ${filtro(f)}`,
  ]);
  // Los que terminaron la fase antes del primer año elegido se agrupan en "Previo".
  const { meses, inicio } = construirMeses(f.anios, porMes.map((r) => r.clave), true);
  const cero = { sgr: 0, solo_test: 0, horas_real: 0, horas_presu: 0 };
  const acum = new Map<string, typeof cero>();
  for (const r of porMes) {
    const k = claveDestino(r.clave, inicio, true);
    const a = acum.get(k) ?? cero;
    acum.set(k, { sgr: a.sgr + r.sgr, solo_test: a.solo_test + r.solo_test,
                  horas_real: a.horas_real + r.horas_real, horas_presu: a.horas_presu + r.horas_presu });
  }
  const mensual: MesFase[] = meses.map((m) => ({ ...m, ...(acum.get(m.clave) ?? cero) }));
  return { total: total ?? AGG_VACIO, responsables, mensual, puntos, sinPresu: sinPresu ?? { sgr: 0, horas: 0 } };
}

/** completo: la lista de SGR con más pausa sin recortar (para exportar). */
export async function tiempos(f: Filtros, { completo = false } = {}) {
  const [fases, tramos, porDevolucion, masPausados, [calidad], porServicio] = await Promise.all([
    sql<(AggFase & { fase: Fase })[]>`select fase, ${aggFase()} from v_fases where ${filtro(f)} group by fase`,
    sql<{ tramo: number; sgr: number }[]>`
      select case when lead_neto <= 7 then 1 when lead_neto <= 15 then 2 when lead_neto <= 30 then 3
                  when lead_neto <= 60 then 4 when lead_neto <= 90 then 5 else 6 end as tramo, count(*) as sgr
      from v_requerimientos where ${filtro(f)} and lead_neto is not null group by 1 order by 1`,
    sql<{ grupo: number; sgr: number; lead_neto_med: number | null; lead_hab_med: number | null; pausa_prom: number;
          real_reg: number; presu_reg: number }[]>`
      select least(devoluciones, 3) as grupo, count(*) as sgr,
             percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med,
             percentile_cont(0.5) within group (order by lead_hab)::float8 as lead_hab_med,
             coalesce(avg(horas_pausadas), 0)::float8 as pausa_prom,
             coalesce(sum(horas_real_total) filter (where horas_real_total > 0), 0)::float8 as real_reg,
             coalesce(sum(horas_presu_total) filter (where horas_real_total > 0), 0)::float8 as presu_reg
      from v_requerimientos where ${filtro(f)} and entregado group by 1 order by 1`,
    sql<{ id_req: string; asunto: string | null; devoluciones: number; horas_pausadas: number; lead_hab: number | null;
          lead_neto: number | null; asignado_a: string | null; asignado_testing: string | null }[]>`
      select id_req, asunto, devoluciones, horas_pausadas::float8, lead_hab, lead_neto::float8, asignado_a, asignado_testing
      from v_requerimientos where ${filtro(f)} and horas_pausadas > 0
      order by horas_pausadas desc ${completo ? sql`` : sql`limit 12`}`,
    sql<{ dev_sin_pausa: number; pausa_sin_dev: number; horas_pausa_con_dev: number; horas_pausa_total: number }[]>`
      select count(*) filter (where devoluciones > 0 and horas_pausadas = 0) as dev_sin_pausa,
             count(*) filter (where devoluciones = 0 and horas_pausadas > 0) as pausa_sin_dev,
             coalesce(sum(horas_pausadas) filter (where devoluciones > 0), 0)::float8 as horas_pausa_con_dev,
             coalesce(sum(horas_pausadas), 0)::float8 as horas_pausa_total
      from v_requerimientos where ${filtro(f)} and entregado`,
    sql<{ servicio: string; sgr: number; lead_neto_med: number | null; lead_hab_med: number | null; pausa_prom: number }[]>`
      select servicio, count(*) as sgr,
             percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med,
             percentile_cont(0.5) within group (order by lead_hab)::float8 as lead_hab_med,
             coalesce(avg(horas_pausadas), 0)::float8 as pausa_prom
      from v_requerimientos where ${filtro(f)} and entregado group by servicio`,
  ]);
  const porFase = (x: Fase) => fases.find((r) => r.fase === x) ?? { ...AGG_VACIO, fase: x };
  porServicio.sort((a, b) => ORDEN_SERVICIOS.indexOf(a.servicio) - ORDEN_SERVICIOS.indexOf(b.servicio));
  return { desa: porFase("desa"), test: porFase("test"), tramos, porDevolucion, masPausados, calidad, porServicio };
}

export type Dimension = "servicio" | "tipo_requerimiento" | "departamento" | "equipo" | "solicitante";

export type FilaDesglose = {
  clave: string; sgr: number; entregados: number; desestimados: number; desarrollos: number; solo_test: number; horas_presu: number; horas_real: number; presu_reg: number; real_reg: number;
  facturado: number; devoluciones: number; sgr_con_devolucion: number; lead_neto_med: number | null;
};

export async function desglose(dim: Dimension, f: Filtros) {
  const col = sql(dim);
  return sql<FilaDesglose[]>`
    select coalesce(${col}, 'Sin dato') as clave, count(*) as sgr,
           count(*) filter (where entregado) as entregados,
           count(*) filter (where desestimado) as desestimados,
           count(*) filter (where entregado and aplica_desa) as desarrollos,
           count(*) filter (where entregado and servicio = 'solo_test') as solo_test,
           coalesce(sum(horas_presu_total), 0)::float8 as horas_presu,
           coalesce(sum(horas_real_total), 0)::float8 as horas_real,
           coalesce(sum(horas_presu_total) filter (where horas_real_total > 0), 0)::float8 as presu_reg,
           coalesce(sum(horas_real_total) filter (where horas_real_total > 0), 0)::float8 as real_reg,
           coalesce(sum(total_facturar), 0)::float8 as facturado,
           coalesce(sum(devoluciones), 0)::int as devoluciones,
           count(*) filter (where devoluciones > 0) as sgr_con_devolucion,
           percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med
    from v_requerimientos where ${filtro(f)}
    group by 1 order by count(*) desc, 1`;
}

export async function facturacion(f: Filtros) {
  return sql<{ periodo: string | null; sgr: number; desestimados: number; total_desestimados: number; importe_test_cliente: number; importe_desa: number; importe_test: number; total: number;
               horas_presu: number; horas_real: number; presu_reg: number; real_reg: number }[]>`
    select to_char(fecha_facturacion, 'YYYY-MM-DD') as periodo, count(*) as sgr,
           count(*) filter (where desestimado) as desestimados,
           coalesce(sum(total_facturar) filter (where desestimado), 0)::float8 as total_desestimados,
           coalesce(sum(importe_test) filter (where servicio = 'solo_test'), 0)::float8 as importe_test_cliente,
           coalesce(sum(case when aplica_desa then importe_desa else 0 end), 0)::float8 as importe_desa,
           coalesce(sum(case when aplica_test then importe_test else 0 end), 0)::float8 as importe_test,
           coalesce(sum(total_facturar), 0)::float8 as total,
           coalesce(sum(horas_presu_total), 0)::float8 as horas_presu,
           coalesce(sum(horas_real_total), 0)::float8 as horas_real,
           coalesce(sum(horas_presu_total) filter (where horas_real_total > 0), 0)::float8 as presu_reg,
           coalesce(sum(horas_real_total) filter (where horas_real_total > 0), 0)::float8 as real_reg
    from v_requerimientos where ${filtro(f)}
    group by fecha_facturacion order by fecha_facturacion nulls last`;
}

export type FilaDetalle = {
  id_req: string; asunto: string | null; departamento: string | null; tipo_requerimiento: string | null;
  equipo: string | null; estado: string | null; desestimado: boolean; servicio: string; desa_sin_presu: boolean; equipo_externo: boolean; aplica_desa: boolean; aplica_test: boolean;
  asignado_a: string | null; asignado_testing: string | null;
  horas_desa: number; horas_presu_desa: number; horas_test: number; horas_presu_test: number;
  devoluciones: number; horas_pausadas: number; horas_pausadas_desa: number; horas_pausadas_test: number;
  fecha_inicio_desa: string | null; fecha_fin_desa: string | null; fecha_inicio_testing: string | null; fecha_fin_testing: string | null;
  implementacion: string | null; fecha_facturacion: string | null; total_facturar: number;
  lead_hab: number | null; lead_neto: number | null;
};

export async function detalle(f: Filtros) {
  return sql<FilaDetalle[]>`
    select id_req, asunto, departamento, tipo_requerimiento, equipo, estado, desestimado, servicio, desa_sin_presu, equipo_externo, aplica_desa, aplica_test,
           asignado_a, asignado_testing, horas_desa, horas_presu_desa, horas_test, horas_presu_test,
           devoluciones, horas_pausadas, horas_pausadas_desa, horas_pausadas_test,
           fecha_inicio_desa, fecha_fin_desa, fecha_inicio_testing, fecha_fin_testing,
           implementacion, fecha_facturacion, total_facturar, lead_hab, lead_neto::float8
    from v_requerimientos where ${filtro(f)}
    order by implementacion desc, id_req`;
}
