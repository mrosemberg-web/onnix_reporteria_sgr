import "server-only";
import { sql } from "./db";
import { EQUIPO_EXTERNOS, EQUIPO_PROPIOS, type Filtros } from "./filtros";

export type Fase = "desa" | "test";

/** Tolerancia para considerar un desvío "leve" (10 % sobre lo presupuestado). */
export const TOLERANCIA = 0.1;

const filtro = (f: Filtros) => sql`
  extract(year from implementacion) = ${f.anio}
  ${f.equipo === EQUIPO_PROPIOS ? sql`and not equipo_externo`
    : f.equipo === EQUIPO_EXTERNOS ? sql`and equipo_externo`
    : f.equipo ? sql`and equipo = ${f.equipo}` : sql``}
  ${f.tipo ? sql`and tipo_requerimiento = ${f.tipo}` : sql``}
  ${f.estado ? sql`and estado = ${f.estado}` : sql``}`;

// ---------------------------------------------------------------------------
// Agregado estándar por fase. "real_reg"/"presu_reg" solo consideran SGR con
// horas cargadas, para que los SGR sin registro de horas no inflen el índice.
// ---------------------------------------------------------------------------
const aggFase = () => sql`
  count(*) as sgr,
  count(*) filter (where entregado) as entregados,
  count(*) filter (where desestimado) as desestimados,
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
  percentile_cont(0.5) within group (order by dias_cal)::float8 as dias_cal_med,
  percentile_cont(0.5) within group (order by dias_netos)::float8 as dias_netos_med,
  coalesce(sum(dias_cal), 0)::float8 as dias_cal_sum,
  coalesce(sum(least(horas_pausadas / 24.0, dias_cal)) filter (where dias_cal is not null), 0)::float8 as dias_pausa_sum,
  coalesce(sum(importe), 0)::float8 as importe`;

export type AggFase = {
  sgr: number; entregados: number; desestimados: number; horas_real: number; horas_presu: number; real_reg: number; presu_reg: number;
  dentro: number; leve: number; sobre: number; sin_registro: number;
  horas_excedidas: number; horas_ahorradas: number; horas_pausadas: number;
  devoluciones: number; sgr_con_devolucion: number;
  dias_cal_med: number | null; dias_netos_med: number | null; dias_cal_sum: number; dias_pausa_sum: number;
  importe: number;
};

export const AGG_VACIO: AggFase = {
  sgr: 0, entregados: 0, desestimados: 0, horas_real: 0, horas_presu: 0, real_reg: 0, presu_reg: 0, dentro: 0, leve: 0, sobre: 0,
  sin_registro: 0, horas_excedidas: 0, horas_ahorradas: 0, horas_pausadas: 0, devoluciones: 0,
  sgr_con_devolucion: 0, dias_cal_med: null, dias_netos_med: null, dias_cal_sum: 0, dias_pausa_sum: 0, importe: 0,
};

/** Índice de cumplimiento: horas presupuestadas ÷ horas trabajadas (≥ 1 = dentro de presupuesto). */
export const indice = (a: { presu_reg: number; real_reg: number }) => (a.real_reg > 0 ? a.presu_reg / a.real_reg : null);
export const pctPausa = (a: AggFase) => (a.dias_cal_sum > 0 ? a.dias_pausa_sum / a.dias_cal_sum : null);

// ---------------------------------------------------------------------------

export async function opciones() {
  const [anios, equipos, tipos, estados, [carga]] = await Promise.all([
    sql<{ anio: number }[]>`select distinct extract(year from implementacion)::int as anio from requerimientos where implementacion is not null order by 1 desc`,
    sql<{ v: string }[]>`select distinct equipo as v from requerimientos where equipo is not null order by 1`,
    sql<{ v: string }[]>`select distinct tipo_requerimiento as v from requerimientos where tipo_requerimiento is not null order by 1`,
    sql<{ v: string }[]>`select distinct estado as v from requerimientos where estado is not null order by 1`,
    sql<{ archivo: string; filas: number; cargado_en: Date; nombre: string | null }[]>`
      select c.archivo, c.filas, c.cargado_en, u.nombre from cargas c left join usuarios u on u.id = c.cargado_por
      order by c.id desc limit 1`,
  ]);
  return {
    anios: anios.map((r) => r.anio),
    equipos: equipos.map((r) => r.v),
    tipos: tipos.map((r) => r.v),
    estados: estados.map((r) => r.v),
    ultimaCarga: carga ?? null,
  };
}

/** Último mes a mostrar: mes en curso si es el año actual, diciembre si es un año cerrado. */
function ultimoMes(anio: number) {
  const tz = process.env.APP_TZ || "America/Asuncion";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric" }).formatToParts(new Date());
  const a = Number(partes.find((p) => p.type === "year")?.value);
  const m = Number(partes.find((p) => p.type === "month")?.value);
  if (anio < a) return 12;
  if (anio === a) return m;
  return 1;
}

export type KpisReq = {
  sgr: number; entregados: number; sgr_pap: number; desestimados: number;
  horas_desestimados: number; facturado_desestimados: number; devoluciones_sin_pausa: number; sgr_desa: number; sgr_test: number; facturado: number; pendiente_facturar: number;
  sgr_pendiente_facturar: number; devoluciones: number; sgr_con_devolucion: number;
  lead_cal_med: number | null; lead_neto_med: number | null; horas_pausadas: number;
  horas_real_total: number; horas_presu_total: number;
};

export async function resumen(f: Filtros) {
  const hasta = ultimoMes(f.anio);
  const [[kpis], fases, mensual] = await Promise.all([
    sql<KpisReq[]>`
      select count(*) as sgr,
             count(*) filter (where entregado) as entregados,
             count(*) filter (where upper(trim(estado)) = 'PAP') as sgr_pap,
             count(*) filter (where desestimado) as desestimados,
             coalesce(sum(horas_real_total) filter (where desestimado), 0)::float8 as horas_desestimados,
             coalesce(sum(total_facturar) filter (where desestimado), 0)::float8 as facturado_desestimados,
             count(*) filter (where devoluciones > 0 and horas_pausadas = 0) as devoluciones_sin_pausa,
             count(*) filter (where aplica_desa) as sgr_desa,
             count(*) filter (where aplica_test) as sgr_test,
             coalesce(sum(total_facturar), 0)::float8 as facturado,
             coalesce(sum(total_facturar) filter (where fecha_facturacion is null), 0)::float8 as pendiente_facturar,
             count(*) filter (where fecha_facturacion is null) as sgr_pendiente_facturar,
             coalesce(sum(devoluciones), 0)::int as devoluciones,
             count(*) filter (where devoluciones > 0) as sgr_con_devolucion,
             percentile_cont(0.5) within group (order by lead_cal)::float8 as lead_cal_med,
             percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med,
             coalesce(sum(horas_pausadas), 0)::float8 as horas_pausadas,
             coalesce(sum(horas_real_total), 0)::float8 as horas_real_total,
             coalesce(sum(horas_presu_total), 0)::float8 as horas_presu_total
      from v_requerimientos where ${filtro(f)}`,
    sql<(AggFase & { fase: Fase })[]>`select fase, ${aggFase()} from v_fases where ${filtro(f)} group by fase`,
    sql<{ mes: number; sgr: number; acumulado: number; desestimados: number; facturado: number; horas_presu: number; horas_real: number }[]>`
      with meses as (select generate_series(1, greatest(${hasta}::int,
                       coalesce((select max(extract(month from implementacion))::int from v_requerimientos where ${filtro(f)}), 1))) as mes),
           d as (select extract(month from implementacion)::int as mes,
                        count(*) filter (where entregado) as sgr,
                        count(*) filter (where desestimado) as desestimados,
                        sum(total_facturar)::float8 as facturado,
                        sum(horas_presu_total)::float8 as horas_presu, sum(horas_real_total)::float8 as horas_real
                 from v_requerimientos where ${filtro(f)} group by 1)
      select m.mes, coalesce(d.sgr, 0) as sgr,
             sum(coalesce(d.sgr, 0)) over (order by m.mes)::int as acumulado,
             coalesce(d.desestimados, 0) as desestimados,
             coalesce(d.facturado, 0) as facturado, coalesce(d.horas_presu, 0) as horas_presu, coalesce(d.horas_real, 0) as horas_real
      from meses m left join d on d.mes = m.mes order by m.mes`,
  ]);
  const porFase = (x: Fase) => fases.find((r) => r.fase === x) ?? { ...AGG_VACIO, fase: x };
  return { kpis, desa: porFase("desa"), test: porFase("test"), mensual, mesEnCurso: hasta };
}

export type FilaResponsable = AggFase & { responsable: string; meses_activos: number };

export async function fase(fz: Fase, f: Filtros) {
  const hasta = ultimoMes(f.anio);
  const [[total], responsables, mensual, puntos] = await Promise.all([
    sql<AggFase[]>`select ${aggFase()} from v_fases where fase = ${fz} and ${filtro(f)}`,
    sql<FilaResponsable[]>`
      select responsable, ${aggFase()},
             count(distinct date_trunc('month', fecha_fin)) as meses_activos
      from v_fases where fase = ${fz} and ${filtro(f)}
      group by responsable order by count(*) filter (where entregado) desc, count(*) desc, responsable`,
    // Entregas de la fase por mes de FIN de la fase. Mes 0 = terminó antes del año (SGR de arrastre).
    sql<{ mes: number; sgr: number; horas_real: number; horas_presu: number; dentro: number }[]>`
      with meses as (select generate_series(0, ${hasta}::int) as mes),
           d as (select case when fecha_fin < make_date(${f.anio}::int, 1, 1) then 0
                             when fecha_fin > make_date(${f.anio}::int, 12, 31) then 12
                             else extract(month from fecha_fin)::int end as mes,
                        count(*) as sgr, sum(horas_real)::float8 as horas_real, sum(horas_presu)::float8 as horas_presu,
                        count(*) filter (where horas_real > 0 and horas_real <= horas_presu) as dentro
                 from v_fases where fase = ${fz} and ${filtro(f)} group by 1)
      select m.mes, coalesce(d.sgr, 0) as sgr, coalesce(d.horas_real, 0) as horas_real,
             coalesce(d.horas_presu, 0) as horas_presu, coalesce(d.dentro, 0) as dentro
      from meses m left join d on d.mes = m.mes
      where m.mes > 0 or d.sgr is not null order by m.mes`,
    sql<{ id_req: string; responsable: string; horas_presu: number; horas_real: number; asunto: string | null }[]>`
      select id_req, responsable, horas_presu::float8, horas_real::float8, asunto
      from v_fases where fase = ${fz} and ${filtro(f)} and (horas_real > 0 or horas_presu > 0)`,
  ]);
  return { total: total ?? AGG_VACIO, responsables, mensual, puntos };
}

export async function tiempos(f: Filtros) {
  const [fases, tramos, porDevolucion, masPausados, [calidad]] = await Promise.all([
    sql<(AggFase & { fase: Fase })[]>`select fase, ${aggFase()} from v_fases where ${filtro(f)} group by fase`,
    sql<{ tramo: number; sgr: number }[]>`
      select case when lead_neto <= 7 then 1 when lead_neto <= 15 then 2 when lead_neto <= 30 then 3
                  when lead_neto <= 60 then 4 when lead_neto <= 90 then 5 else 6 end as tramo, count(*) as sgr
      from v_requerimientos where ${filtro(f)} and lead_neto is not null group by 1 order by 1`,
    sql<{ grupo: number; sgr: number; lead_neto_med: number | null; lead_cal_med: number | null; pausa_prom: number;
          real_reg: number; presu_reg: number }[]>`
      select least(devoluciones, 3) as grupo, count(*) as sgr,
             percentile_cont(0.5) within group (order by lead_neto)::float8 as lead_neto_med,
             percentile_cont(0.5) within group (order by lead_cal)::float8 as lead_cal_med,
             coalesce(avg(horas_pausadas), 0)::float8 as pausa_prom,
             coalesce(sum(horas_real_total) filter (where horas_real_total > 0), 0)::float8 as real_reg,
             coalesce(sum(horas_presu_total) filter (where horas_real_total > 0), 0)::float8 as presu_reg
      from v_requerimientos where ${filtro(f)} and entregado group by 1 order by 1`,
    sql<{ id_req: string; asunto: string | null; devoluciones: number; horas_pausadas: number; lead_cal: number | null;
          lead_neto: number | null; asignado_a: string | null; asignado_testing: string | null }[]>`
      select id_req, asunto, devoluciones, horas_pausadas::float8, lead_cal, lead_neto::float8, asignado_a, asignado_testing
      from v_requerimientos where ${filtro(f)} and horas_pausadas > 0
      order by horas_pausadas desc limit 12`,
    sql<{ dev_sin_pausa: number; pausa_sin_dev: number; horas_pausa_con_dev: number; horas_pausa_total: number }[]>`
      select count(*) filter (where devoluciones > 0 and horas_pausadas = 0) as dev_sin_pausa,
             count(*) filter (where devoluciones = 0 and horas_pausadas > 0) as pausa_sin_dev,
             coalesce(sum(horas_pausadas) filter (where devoluciones > 0), 0)::float8 as horas_pausa_con_dev,
             coalesce(sum(horas_pausadas), 0)::float8 as horas_pausa_total
      from v_requerimientos where ${filtro(f)} and entregado`,
  ]);
  const porFase = (x: Fase) => fases.find((r) => r.fase === x) ?? { ...AGG_VACIO, fase: x };
  return { desa: porFase("desa"), test: porFase("test"), tramos, porDevolucion, masPausados, calidad };
}

export type Dimension = "tipo_requerimiento" | "departamento" | "equipo" | "solicitante";

export type FilaDesglose = {
  clave: string; sgr: number; entregados: number; desestimados: number; horas_presu: number; horas_real: number; presu_reg: number; real_reg: number;
  facturado: number; devoluciones: number; sgr_con_devolucion: number; lead_neto_med: number | null;
};

export async function desglose(dim: Dimension, f: Filtros) {
  const col = sql(dim);
  return sql<FilaDesglose[]>`
    select coalesce(${col}, 'Sin dato') as clave, count(*) as sgr,
           count(*) filter (where entregado) as entregados,
           count(*) filter (where desestimado) as desestimados,
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
  return sql<{ periodo: string | null; sgr: number; desestimados: number; total_desestimados: number; importe_desa: number; importe_test: number; total: number;
               horas_presu: number; horas_real: number; presu_reg: number; real_reg: number }[]>`
    select to_char(fecha_facturacion, 'YYYY-MM-DD') as periodo, count(*) as sgr,
           count(*) filter (where desestimado) as desestimados,
           coalesce(sum(total_facturar) filter (where desestimado), 0)::float8 as total_desestimados,
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
  equipo: string | null; estado: string | null; desestimado: boolean; equipo_externo: boolean; aplica_desa: boolean; aplica_test: boolean;
  asignado_a: string | null; asignado_testing: string | null;
  horas_desa: number; horas_presu_desa: number; horas_test: number; horas_presu_test: number;
  devoluciones: number; horas_pausadas: number; horas_pausadas_desa: number; horas_pausadas_test: number;
  fecha_inicio_desa: string | null; fecha_fin_desa: string | null; fecha_inicio_testing: string | null; fecha_fin_testing: string | null;
  implementacion: string | null; fecha_facturacion: string | null; total_facturar: number;
  lead_cal: number | null; lead_neto: number | null;
};

export async function detalle(f: Filtros) {
  return sql<FilaDetalle[]>`
    select id_req, asunto, departamento, tipo_requerimiento, equipo, estado, desestimado, equipo_externo, aplica_desa, aplica_test,
           asignado_a, asignado_testing, horas_desa, horas_presu_desa, horas_test, horas_presu_test,
           devoluciones, horas_pausadas, horas_pausadas_desa, horas_pausadas_test,
           fecha_inicio_desa, fecha_fin_desa, fecha_inicio_testing, fecha_fin_testing,
           implementacion, fecha_facturacion, total_facturar, lead_cal, lead_neto::float8
    from v_requerimientos where ${filtro(f)}
    order by implementacion desc, id_req`;
}
