import "server-only";
// Qué se exporta de cada pantalla. Cada región arma sus filas con las mismas
// consultas y reglas que la pantalla, respetando los filtros de la URL.
import { nombreEstado } from "../estados";
import { describirFiltros, leerFiltros, textoAnios, type Filtros, type SearchParams } from "../filtros";
import { fecha, fechaHora } from "../formato";
import {
  desglose, detalle, facturacion, fase, indice, opciones, pctPausa, resumen, tiempos, TOLERANCIA,
  type AggFase, type Dimension, type Fase,
} from "../reportes";
import {
  aplicarFiltros, cargarSeguimiento, leerFiltrosSeguimiento, opcionesSeguimiento, type FiltrosSeguimiento,
} from "../seguimiento";
import {
  agruparPorPersona, CAUSAS, EJECUCION, ETAPAS, ETIQUETA_DEVOLUCIONES, ORDEN_CAUSAS, ORDEN_ETAPAS, porDevolucionesTesting,
  resumir, SITUACIONES, type Analisis, type Ejecucion,
} from "../seguimiento-calculo";
import { nombreServicio } from "../servicios";
import { cols, type DefRegion, type PaginaExcel, type Region } from "./tipos";

const FASE = { desa: "Desarrollo", test: "Testing" } as const;
const una = (r: Region) => [r];

// ===========================================================================
// Implementados
// ===========================================================================

async function contextoHistorico(sp: SearchParams) {
  const op = await opciones();
  const f = leerFiltros(sp, op.anios);
  const meta: [string, string][] = [
    ["Filtros aplicados", describirFiltros(f, { estado: nombreEstado, servicio: nombreServicio })],
    ["Datos", op.ultimaCarga ? `«${op.ultimaCarga.archivo}», cargado el ${fechaHora(op.ultimaCarga.cargado_en)}` : "Sin carga"],
    ["Días", "Plazos en días hábiles (lunes a viernes, sin feriados). 8 horas pausadas = 1 día."],
  ];
  return { f, meta };
}

function paginaResumen(f: Filtros): DefRegion[] {
  const datos = memo(() => resumen(f));
  return [
    { id: "entregas_mes", titulo: "Entregas por mes", construir: async () => una({
      id: "entregas_mes", titulo: "Entregas por mes",
      columnas: cols(["mes", "Mes", "texto"], ["anio", "Año", "entero"], ["desarrollos", "Desarrollos entregados", "entero"],
        ["solo_test", "Solo testing (desarrollo del cliente)", "entero"], ["acumulado", "Desarrollos acumulados del año", "entero"]),
      filas: (await datos()).mensual.map((m) => ({ mes: m.etiqueta, anio: m.anio, desarrollos: m.desarrollos, solo_test: m.solo_test, acumulado: m.acumulado_desa })),
      nota: "Por mes de implementación. No incluye SGR desestimados por el cliente.",
    }) },
    { id: "horas_mes", titulo: "Horas por mes", construir: async () => una({
      id: "horas_mes", titulo: "Horas por mes",
      columnas: cols(["mes", "Mes", "texto"], ["anio", "Año", "entero"], ["presu", "Horas presupuestadas", "horas"],
        ["real", "Horas trabajadas", "horas"], ["indice", "Índice (presupuestadas ÷ trabajadas)", "indice"], ["facturado", "Facturado (Gs.)", "gs"]),
      filas: (await datos()).mensual.map((m) => ({ mes: m.etiqueta, anio: m.anio, presu: m.horas_presu, real: m.horas_real,
        indice: m.horas_real ? m.horas_presu / m.horas_real : null, facturado: m.facturado })),
      nota: "Desarrollo y testing sumados, por mes de implementación. Solo cuentan horas de desarrollo con presupuesto de desarrollo.",
    }) },
  ];
}

const colsAgg = (incluirCliente: boolean) => cols(
  ["sgr", "SGR", "entero"], ...(incluirCliente ? [["solo_test", "Sobre desarrollos del cliente", "entero"] as [string, string, "entero"]] : []),
  ["entregados", "Entregados", "entero"], ["desestimados", "Desestimados", "entero"], ["sin_registro", "Sin horas cargadas", "entero"],
  ["real", "Horas trabajadas", "horas"], ["presu", "Horas presupuestadas", "horas"], ["desvio", "Desvío (h, SGR con horas)", "horas"],
  ["indice", "Índice de cumplimiento", "indice"], ["dentro", "Dentro del presupuesto", "entero"], ["leve", "Desvío hasta 10 %", "entero"],
  ["sobre", "Desvío mayor a 10 %", "entero"], ["pct_dentro", "En presupuesto (%)", "pct"], ["horas_sgr", "Horas por SGR", "horas"],
  ["devoluciones", "Devoluciones al cliente", "entero"], ["sgr_dev", "SGR devueltos al cliente", "entero"],
  ["netos", "Duración mediana sin pausas (días hábiles)", "dias"], ["con_pausas", "Duración mediana con pausas (días hábiles)", "dias"],
  ["pausadas", "Horas pausadas", "horas"], ["pct_pausa", "Tiempo en pausa (%)", "pct"], ["importe", "Importe (Gs.)", "gs"],
);
const filaAgg = (a: AggFase) => {
  const ch = a.sgr - a.sin_registro;
  return {
    sgr: a.sgr, solo_test: a.solo_test, entregados: a.entregados, desestimados: a.desestimados, sin_registro: a.sin_registro,
    real: a.horas_real, presu: a.horas_presu, desvio: a.real_reg - a.presu_reg, indice: indice(a), dentro: a.dentro, leve: a.leve,
    sobre: a.sobre, pct_dentro: ch ? a.dentro / ch : null, horas_sgr: ch ? a.real_reg / ch : null, devoluciones: a.devoluciones,
    sgr_dev: a.sgr_con_devolucion, netos: a.dias_netos_med, con_pausas: a.dias_hab_med, pausadas: a.horas_pausadas,
    pct_pausa: pctPausa(a), importe: a.importe,
  };
};

function paginaFase(fz: Fase, f: Filtros): DefRegion[] {
  const datos = memo(() => fase(fz, f));
  const persona = fz === "desa" ? "Desarrollador" : "Tester";
  const nombre = FASE[fz];
  return [
    { id: "por_persona", titulo: `Por ${persona.toLowerCase()}`, construir: async () => {
      const d = await datos();
      return una({
        id: "por_persona", titulo: `Productividad por ${persona.toLowerCase()}`,
        columnas: [...cols(["persona", persona, "texto"]), ...colsAgg(fz === "test"), ...cols(["sgr_mes", "SGR por mes activo", "decimal"])],
        filas: [
          ...d.responsables.map((r) => ({ persona: r.responsable, ...filaAgg(r), sgr_mes: r.meses_activos ? r.sgr / r.meses_activos : null })),
          { persona: "Total", ...filaAgg(d.total) },
        ],
        nota: `Índice = horas presupuestadas ÷ trabajadas, solo en SGR con horas cargadas. Desvío leve: hasta ${TOLERANCIA * 100} % sobre lo presupuestado.`,
      });
    } },
    { id: "por_mes", titulo: `${nombre} terminado por mes`, construir: async () => {
      let acc = 0, anio: number | null = null;
      return una({
        id: "por_mes", titulo: `${nombre} terminado por mes`,
        columnas: cols(["mes", "Mes", "texto"], ["sgr", "SGR terminados", "entero"],
          ...(fz === "test" ? [["cliente", "Sobre desarrollos del cliente", "entero"] as [string, string, "entero"]] : []),
          ["acumulado", "Acumulado del año", "entero"]),
        filas: (await datos()).mensual.map((m) => {
          if (m.anio !== anio) { anio = m.anio; acc = 0; }
          acc += m.sgr;
          return { mes: m.etiqueta, sgr: m.sgr, cliente: m.solo_test, acumulado: acc };
        }),
        nota: "Por mes de fin de la fase. «Previo» agrupa los que terminaron antes del período elegido.",
      });
    } },
    { id: "horas_mes", titulo: "Horas por mes de fin de fase", construir: async () => una({
      id: "horas_mes", titulo: "Horas por mes de fin de fase",
      columnas: cols(["mes", "Mes", "texto"], ["presu", "Horas presupuestadas", "horas"], ["real", "Horas trabajadas", "horas"]),
      filas: (await datos()).mensual.map((m) => ({ mes: m.etiqueta, presu: m.horas_presu, real: m.horas_real })),
    }) },
    { id: "precision", titulo: "Precisión por SGR", construir: async () => una({
      id: "precision", titulo: "Precisión de la estimación",
      columnas: cols(["sgr", "SGR", "texto"], ["responsable", persona, "texto"], ["asunto", "Asunto", "texto"],
        ["presu", "Horas presupuestadas", "horas"], ["real", "Horas trabajadas", "horas"], ["desvio", "Desvío (h)", "horas"],
        ["estado", "Resultado", "texto"]),
      filas: (await datos()).puntos.map((p) => ({
        sgr: p.id_req, responsable: p.responsable, asunto: p.asunto, presu: p.horas_presu, real: p.horas_real,
        desvio: p.horas_real - p.horas_presu,
        estado: p.horas_real === 0 ? "Sin horas cargadas" : p.horas_real <= p.horas_presu ? "Dentro del presupuesto"
          : p.horas_real <= p.horas_presu * (1 + TOLERANCIA) ? "Desvío hasta 10 %" : "Desvío mayor a 10 %",
      })),
    }) },
  ];
}

const TRAMOS = ["Hasta 7 días hábiles", "8 a 15", "16 a 30", "31 a 60", "61 a 90", "Más de 90"];
const GRUPOS_DEV = ["Sin devoluciones al cliente", "1 devolución", "2 devoluciones", "3 o más"];

function paginaTiempos(f: Filtros): DefRegion[] {
  const datos = memo(() => tiempos(f, { completo: true }));
  const fila = (n: string, a: AggFase) => ({ fase: n, sgr: a.sgr, con_pausas: a.dias_hab_med, netos: a.dias_netos_med, pausadas: a.horas_pausadas, pct: pctPausa(a) });
  return [
    { id: "duracion_fase", titulo: "Duración por fase", construir: async () => {
      const d = await datos();
      return una({ id: "duracion_fase", titulo: "Duración por fase",
        columnas: cols(["fase", "Fase", "texto"], ["sgr", "SGR con la fase", "entero"], ["con_pausas", "Mediana con pausas (días hábiles)", "dias"],
          ["netos", "Mediana sin pausas (días hábiles)", "dias"], ["pausadas", "Horas pausadas", "horas"], ["pct", "Parte del tiempo en pausa", "pct"]),
        filas: [fila("Desarrollo", d.desa), fila("Testing", d.test)] });
    } },
    { id: "tramos", titulo: "Tiempo total de entrega", construir: async () => una({
      id: "tramos", titulo: "Tiempo total de entrega",
      columnas: cols(["tramo", "Días hábiles sin pausas", "texto"], ["sgr", "SGR", "entero"]),
      filas: (await datos()).tramos.map((t) => ({ tramo: TRAMOS[t.tramo - 1], sgr: t.sgr })),
      nota: "Desde el inicio de la primera fase hasta la implementación. Solo SGR entregados.",
    }) },
    { id: "por_servicio", titulo: "Entrega por servicio", construir: async () => una({
      id: "por_servicio", titulo: "Tiempo de entrega por servicio",
      columnas: cols(["servicio", "Servicio", "texto"], ["sgr", "SGR entregados", "entero"], ["netos", "Mediana sin pausas (días hábiles)", "dias"],
        ["con_pausas", "Mediana con pausas (días hábiles)", "dias"], ["pausa", "Pausa promedio por SGR (h)", "horas"]),
      filas: (await datos()).porServicio.map((r) => ({ servicio: nombreServicio(r.servicio), sgr: r.sgr, netos: r.lead_neto_med, con_pausas: r.lead_hab_med, pausa: r.pausa_prom })),
    }) },
    { id: "por_devoluciones", titulo: "Impacto de devoluciones", construir: async () => una({
      id: "por_devoluciones", titulo: "Impacto de las devoluciones al cliente",
      columnas: cols(["grupo", "Devoluciones al cliente", "texto"], ["sgr", "SGR", "entero"], ["netos", "Entrega, mediana sin pausas (días hábiles)", "dias"],
        ["con_pausas", "Entrega, mediana con pausas (días hábiles)", "dias"], ["pausa", "Pausa promedio por SGR (h)", "horas"], ["indice", "Índice de cumplimiento", "indice"]),
      filas: (await datos()).porDevolucion.map((g) => ({ grupo: GRUPOS_DEV[g.grupo], sgr: g.sgr, netos: g.lead_neto_med, con_pausas: g.lead_hab_med, pausa: g.pausa_prom, indice: indice(g) })),
    }) },
    { id: "mas_pausados", titulo: "SGR con tiempo en pausa", construir: async () => una({
      id: "mas_pausados", titulo: "SGR con tiempo en pausa",
      columnas: cols(["sgr", "SGR", "texto"], ["asunto", "Asunto", "texto"], ["desa", "Desarrollo", "texto"], ["test", "Testing", "texto"],
        ["devoluciones", "Devoluciones al cliente", "entero"], ["pausadas", "Horas pausadas", "horas"],
        ["con_pausas", "Entrega con pausas (días hábiles)", "dias"], ["netos", "Entrega sin pausas (días hábiles)", "dias"]),
      filas: (await datos()).masPausados.map((r) => ({ sgr: r.id_req, asunto: r.asunto, desa: r.asignado_a, test: r.asignado_testing,
        devoluciones: r.devoluciones, pausadas: r.horas_pausadas, con_pausas: r.lead_hab, netos: r.lead_neto })),
      nota: "Lista completa, de mayor a menor tiempo en pausa (en pantalla se muestran los 12 primeros).",
    }) },
  ];
}

const DIMS: { clave: Dimension; texto: string }[] = [
  { clave: "servicio", texto: "Servicio" }, { clave: "tipo_requerimiento", texto: "Tipo de requerimiento" },
  { clave: "departamento", texto: "Departamento" }, { clave: "equipo", texto: "Equipo" }, { clave: "solicitante", texto: "Solicitante" },
];

function paginaDesglose(f: Filtros): DefRegion[] {
  return DIMS.map((d) => ({
    id: `desglose_${d.clave}`, titulo: `Por ${d.texto.toLowerCase()}`, construir: async () => {
      const filas = await desglose(d.clave, f);
      const total = filas.reduce((s, r) => s + r.facturado, 0);
      return una({
        id: `desglose_${d.clave}`, titulo: `Por ${d.texto.toLowerCase()}`,
        columnas: cols(["clave", d.texto, "texto"], ["desarrollos", "Desarrollos entregados", "entero"], ["solo_test", "Solo testing", "entero"],
          ["desestimados", "Desestimados", "entero"], ["sgr", "SGR en total", "entero"], ["real", "Horas trabajadas", "horas"],
          ["presu", "Horas presupuestadas", "horas"], ["indice", "Índice de cumplimiento", "indice"], ["facturado", "Facturado (Gs.)", "gs"],
          ["parte", "Parte del total facturado", "pct"], ["sgr_dev", "SGR devueltos al cliente", "entero"], ["devoluciones", "Devoluciones", "entero"],
          ["entrega", "Entrega mediana sin pausas (días hábiles)", "dias"]),
        filas: filas.map((r) => ({
          clave: d.clave === "servicio" ? nombreServicio(r.clave) : r.clave, desarrollos: r.desarrollos, solo_test: r.solo_test,
          desestimados: r.desestimados, sgr: r.sgr, real: r.horas_real, presu: r.horas_presu, indice: indice(r), facturado: r.facturado,
          parte: total ? r.facturado / total : null, sgr_dev: r.sgr_con_devolucion, devoluciones: r.devoluciones, entrega: r.lead_neto_med,
        })),
      });
    },
  }));
}

function paginaFacturacion(f: Filtros): DefRegion[] {
  return [{ id: "periodos", titulo: "Por período de facturación", construir: async () => una({
    id: "periodos", titulo: "Por período de facturación",
    columnas: cols(["fecha", "Fecha de facturación", "fecha"], ["situacion", "Situación", "texto"], ["sgr", "SGR", "entero"],
      ["desestimados", "Desestimados", "entero"], ["desa", "Desarrollo (Gs.)", "gs"], ["test", "Testing (Gs.)", "gs"],
      ["test_cliente", "Testing sobre desarrollos del cliente (Gs.)", "gs"], ["total", "Total (Gs.)", "gs"],
      ["presu", "Horas facturadas", "horas"], ["real", "Horas trabajadas", "horas"], ["indice", "Índice de cumplimiento", "indice"]),
    filas: (await facturacion(f)).map((p) => ({
      fecha: p.periodo, situacion: p.periodo ? "Facturado" : "Sin fecha de facturación", sgr: p.sgr, desestimados: p.desestimados,
      desa: p.importe_desa, test: p.importe_test, test_cliente: p.importe_test_cliente, total: p.total, presu: p.horas_presu,
      real: p.horas_real, indice: indice(p),
    })),
    nota: "Las horas facturadas son las presupuestadas de cada fase.",
  }) }];
}

function paginaRequerimientos(f: Filtros): DefRegion[] {
  return [{ id: "detalle", titulo: "Detalle de SGR", construir: async () => una({
    id: "detalle", titulo: "Detalle de SGR",
    columnas: cols(["sgr", "SGR", "texto"], ["asunto", "Asunto", "texto"], ["estado", "Estado", "texto"], ["servicio", "Servicio", "texto"],
      ["departamento", "Departamento", "texto"], ["tipo", "Tipo", "texto"], ["equipo", "Equipo", "texto"],
      ["desa", "Desarrollador", "texto"], ["h_desa", "Horas desarrollo", "horas"], ["p_desa", "Presupuesto desarrollo", "horas"],
      ["pa_desa", "Horas pausadas desarrollo", "horas"], ["ini_desa", "Inicio desarrollo", "fecha"], ["fin_desa", "Fin desarrollo", "fecha"],
      ["test", "Tester", "texto"], ["h_test", "Horas testing", "horas"], ["p_test", "Presupuesto testing", "horas"],
      ["pa_test", "Horas pausadas testing", "horas"], ["ini_test", "Inicio testing", "fecha"], ["fin_test", "Fin testing", "fecha"],
      ["devoluciones", "Devoluciones al cliente", "entero"], ["pausadas", "Horas pausadas (total)", "horas"],
      ["implementacion", "Implementación", "fecha"], ["facturacion", "Fecha de facturación", "fecha"], ["total", "Total a facturar (Gs.)", "gs"],
      ["con_pausas", "Entrega con pausas (días hábiles)", "dias"], ["netos", "Entrega sin pausas (días hábiles)", "dias"]),
    filas: (await detalle(f)).map((r) => ({
      sgr: r.id_req, asunto: r.asunto, estado: nombreEstado(r.estado), servicio: nombreServicio(r.servicio), departamento: r.departamento,
      tipo: r.tipo_requerimiento, equipo: r.equipo,
      desa: r.aplica_desa ? r.asignado_a : r.aplica_test ? "Desarrollo del cliente" : "Sin desarrollo",
      h_desa: r.aplica_desa ? r.horas_desa : null, p_desa: r.aplica_desa ? r.horas_presu_desa : null,
      pa_desa: r.aplica_desa ? r.horas_pausadas_desa : null, ini_desa: r.aplica_desa ? r.fecha_inicio_desa : null,
      fin_desa: r.aplica_desa ? r.fecha_fin_desa : null,
      test: r.aplica_test ? r.asignado_testing : "Sin testing", h_test: r.aplica_test ? r.horas_test : null,
      p_test: r.aplica_test ? r.horas_presu_test : null, pa_test: r.aplica_test ? r.horas_pausadas_test : null,
      ini_test: r.aplica_test ? r.fecha_inicio_testing : null, fin_test: r.aplica_test ? r.fecha_fin_testing : null,
      devoluciones: r.devoluciones, pausadas: r.horas_pausadas, implementacion: r.implementacion, facturacion: r.fecha_facturacion,
      total: r.total_facturar, con_pausas: r.lead_hab, netos: r.lead_neto,
    })),
    nota: "Las horas de desarrollo solo figuran en SGR con presupuesto de desarrollo (desarrollos de Onnix).",
  }) }];
}

// ===========================================================================
// En curso
// ===========================================================================

async function contextoSeguimiento(sp: SearchParams) {
  const datos = await cargarSeguimiento();
  const f = leerFiltrosSeguimiento(sp);
  const op = opcionesSeguimiento(datos.analisis);
  const nombre = (u: string) => op.nombres.get(u) ?? u;
  const partes: string[] = [];
  if (f.fases.length) partes.push(`Fase: ${f.fases.map((x) => FASE[x as Fase] ?? x).join(", ")}`);
  if (f.lideres.length) partes.push(`Líder: ${f.lideres.map(nombre).join(", ")}`);
  if (f.personas.length) partes.push(`Persona: ${f.personas.map(nombre).join(", ")}`);
  if (f.servicios.length) partes.push(`Tipo de servicio: ${f.servicios.join(", ")}`);
  if (f.etapas.length) partes.push(`Etapa: ${f.etapas.map((e) => ETAPAS[e as keyof typeof ETAPAS]?.nombre ?? e).join(", ")}`);
  if (f.situaciones.length) partes.push(`Situación: ${f.situaciones.map((s) => SITUACIONES[s as keyof typeof SITUACIONES]?.nombre ?? s).join(", ")}`);
  const meta: [string, string][] = [
    ["Filtros aplicados", partes.length ? partes.join(". ") + "." : "Sin filtros."],
    ["Fecha de corte", datos.cargas.map((c) => `${c.tipo === "seguimiento_desa" ? "Desarrollo" : "Testing"}: ${fecha(c.fecha_corte)} («${c.archivo}»)`).join("; ") || "Sin cargas"],
    ["Días", "Atrasos y plazos en días hábiles (lunes a viernes, sin feriados). 8 horas pausadas = 1 día."],
  ];
  return { ...datos, f, meta };
}

const colsDetalleSeg = cols(
  ["sgr", "SGR", "texto"], ["fase", "Fase", "texto"], ["asunto", "Asunto", "texto"], ["responsable", "Responsable", "texto"],
  ["usuario", "Usuario", "texto"], ["lider", "Líder", "texto"], ["tservicio", "Tipo de servicio", "texto"], ["estado", "Estado", "texto"],
  ["etapa", "Etapa", "texto"], ["situacion", "Situación", "texto"], ["fecha_estado", "Fecha del estado", "fecha"],
  ["dias_estado", "Días hábiles en el estado", "entero"], ["inicio", "Inicio", "fecha"], ["estimada", "Entrega estimada", "fecha"],
  ["corregida", "Entrega corregida por pausas", "fecha"], ["atraso", "Atraso (días hábiles)", "entero"], ["causa", "Causa principal", "texto"],
  ["c_pausas", "Pausas anteriores", "entero"], ["c_cliente", "Espera del cliente", "entero"], ["c_dev", "Devoluciones de testing", "entero"],
  ["c_pausa", "Pausa sin motivo", "entero"], ["c_ejec", "Ejecución", "entero"], ["diag", "Diagnóstico de ejecución", "texto"],
  ["devoluciones", "Devoluciones al desarrollador", "entero"], ["ayer", "Horas ayer", "horas"], ["trab", "Horas trabajadas", "horas"],
  ["presu", "Horas presupuestadas", "horas"], ["consumo", "Horas usadas", "pct"], ["excedidas", "Horas excedidas", "horas"],
  ["pausadas", "Horas pausadas de la fase", "horas"], ["otras", "Otras horas pausadas", "horas"],
  ["sin_registrar", "Días detenido sin pausa registrada", "entero"], ["importe", "Importe total (Gs.)", "gs"],
);
const filaSeg = (a: Analisis) => ({
  sgr: a.id_req, fase: FASE[a.fase], asunto: a.asunto, responsable: a.nombre ?? a.usuario, usuario: a.usuario, lider: a.lider,
  tservicio: a.tipo_servicio, estado: a.estado, etapa: ETAPAS[a.etapa].nombre, situacion: SITUACIONES[a.situacion].nombre,
  fecha_estado: a.fecha_estado, dias_estado: a.diasEnEstado, inicio: a.fecha_inicio, estimada: a.entrega_estimada, corregida: a.entregaCorregida,
  atraso: a.atraso, causa: a.causaPrincipal ? CAUSAS[a.causaPrincipal].nombre : null,
  c_pausas: a.atraso ? a.causas.pausas : null, c_cliente: a.atraso ? a.causas.cliente : null, c_dev: a.atraso ? a.causas.devoluciones : null,
  c_pausa: a.atraso ? a.causas.pausa : null, c_ejec: a.atraso ? a.causas.ejecucion : null,
  diag: a.ejecucion ? EJECUCION[a.ejecucion].nombre : null, devoluciones: a.devoluciones, ayer: a.horas_ayer, trab: a.horas_trab,
  presu: a.horas_presu, consumo: a.consumo, excedidas: a.horasExcedidas || null, pausadas: a.horas_pausadas_fase,
  otras: a.otras_horas_pausadas, sin_registrar: a.pausaSinRegistrar || null, importe: a.importe_total,
});
const ORDEN_SIT = { atrasado: 0, vence_pronto: 1, en_plazo: 2, fin_tarde: 3, replanificacion: 4, sin_plan: 5, fin_a_tiempo: 6, sin_asignacion: 7 };
const ordenar = (l: Analisis[]) => [...l].sort((a, b) => ORDEN_SIT[a.situacion] - ORDEN_SIT[b.situacion] || (b.atraso ?? 0) - (a.atraso ?? 0));

function paginaEnCurso(items: Analisis[]): DefRegion[] {
  const sgr = items.filter((a) => a.etapa !== "sin_asignacion");
  const porFase = { desa: resumir(sgr.filter((a) => a.fase === "desa")), test: resumir(sgr.filter((a) => a.fase === "test")) };
  return [
    { id: "atraso_causa", titulo: "Atraso por causa", construir: async () => una({
      id: "atraso_causa", titulo: "Atraso por causa",
      columnas: [...cols(["fase", "Fase", "texto"]), ...ORDEN_CAUSAS.map((c) => ({ clave: c, titulo: CAUSAS[c].nombre, tipo: "entero" as const })),
        ...cols(["total", "Total (días hábiles)", "entero"], ["atrasados", "SGR atrasados", "entero"])],
      filas: (["desa", "test"] as const).map((fz) => ({ fase: FASE[fz], ...porFase[fz].causas, total: porFase[fz].diasAtraso, atrasados: porFase[fz].atrasados })),
      nota: ORDEN_CAUSAS.map((c) => `${CAUSAS[c].nombre}: ${CAUSAS[c].ayuda}`).join(" "),
    }) },
    { id: "etapas", titulo: "Dónde están hoy", construir: async () => una({
      id: "etapas", titulo: "Dónde están hoy",
      columnas: [...cols(["fase", "Fase", "texto"]), ...ORDEN_ETAPAS.map((e) => ({ clave: e, titulo: ETAPAS[e].nombre, tipo: "entero" as const })),
        ...cols(["total", "Total", "entero"])],
      filas: (["desa", "test"] as const).map((fz) => ({ fase: FASE[fz], ...porFase[fz].porEtapa, total: porFase[fz].sgr })),
    }) },
    { id: "ejecucion", titulo: "Atraso por ejecución", construir: async () => una({
      id: "ejecucion", titulo: "Atraso por ejecución",
      columnas: cols(["diag", "Diagnóstico", "texto"], ["ayuda", "Qué significa", "texto"], ["desa", "SGR de desarrollo", "entero"],
        ["test", "SGR de testing", "entero"], ["dias", "Días hábiles", "entero"]),
      filas: (Object.keys(EJECUCION) as Ejecucion[]).map((t) => {
        const l = sgr.filter((a) => a.etapa !== "finalizado" && a.ejecucion === t);
        return { diag: EJECUCION[t].nombre, ayuda: EJECUCION[t].ayuda, desa: l.filter((a) => a.fase === "desa").length,
          test: l.filter((a) => a.fase === "test").length, dias: l.reduce((s, a) => s + a.causas.ejecucion, 0) };
      }),
    }) },
    { id: "avance", titulo: "Horas contra plazo", construir: async () => una({
      id: "avance", titulo: "Horas usadas contra plazo",
      columnas: cols(["sgr", "SGR", "texto"], ["fase", "Fase", "texto"], ["responsable", "Responsable", "texto"], ["asunto", "Asunto", "texto"],
        ["avance", "Plazo transcurrido sin pausas", "pct"], ["consumo", "Horas usadas del presupuesto", "pct"],
        ["trab", "Horas trabajadas", "horas"], ["presu", "Horas presupuestadas", "horas"]),
      filas: sgr.filter((a) => a.etapa === "activo" && a.avance != null && a.consumo != null).map((a) => ({
        sgr: a.id_req, fase: FASE[a.fase], responsable: a.nombre ?? a.usuario, asunto: a.asunto, avance: a.avance, consumo: a.consumo,
        trab: a.horas_trab, presu: a.horas_presu })),
      nota: "SGR en trabajo con fecha y presupuesto.",
    }) },
    { id: "mas_atrasados", titulo: "SGR atrasados", construir: async () => una({
      id: "mas_atrasados", titulo: "SGR atrasados", columnas: colsDetalleSeg,
      filas: ordenar(sgr.filter((a) => a.situacion === "atrasado")).map(filaSeg),
      nota: "Lista completa, del mayor al menor atraso (en pantalla se muestran los 12 primeros).",
    }) },
    { id: "esperando_cliente", titulo: "Esperando al cliente", construir: async () => una({
      id: "esperando_cliente", titulo: "Esperando al cliente",
      columnas: cols(["sgr", "SGR", "texto"], ["asunto", "Asunto", "texto"], ["fase", "Fase", "texto"], ["responsable", "Responsable", "texto"],
        ["estado", "Estado", "texto"], ["desde", "Desde", "fecha"], ["dias", "Días hábiles esperando", "entero"], ["atraso", "Atraso (días hábiles)", "entero"]),
      filas: sgr.filter((a) => a.etapa === "cliente").sort((a, b) => (b.diasEnEstado ?? 0) - (a.diasEnEstado ?? 0)).map((a) => ({
        sgr: a.id_req, asunto: a.asunto, fase: FASE[a.fase], responsable: a.nombre ?? a.usuario, estado: a.estado, desde: a.fecha_estado,
        dias: a.diasEnEstado, atraso: a.atraso })),
    }) },
  ];
}

function paginaSeguimientoFase(fz: Fase, items: Analisis[]): DefRegion[] {
  const persona = fz === "desa" ? "Desarrollador" : "Tester";
  const personas = agruparPorPersona(items);
  const regiones: DefRegion[] = [
    { id: "atraso_persona", titulo: "Atraso por persona", construir: async () => una({
      id: "atraso_persona", titulo: `Atraso por ${persona.toLowerCase()} y causa`,
      columnas: [...cols(["persona", persona, "texto"]), ...ORDEN_CAUSAS.map((c) => ({ clave: c, titulo: CAUSAS[c].nombre, tipo: "entero" as const })),
        ...cols(["total", "Total (días hábiles)", "entero"])],
      filas: personas.filter((p) => p.r.diasAtraso > 0).map((p) => ({ persona: p.nombre, ...p.r.causas, total: p.r.diasAtraso })),
    }) },
    { id: "por_persona", titulo: `Por ${persona.toLowerCase()}`, construir: async () => una({
      id: "por_persona", titulo: `Por ${persona.toLowerCase()}`,
      columnas: cols(["persona", persona, "texto"], ["usuario", "Usuario", "texto"], ["lider", "Líder", "texto"], ["sgr", "SGR", "entero"],
        ["activo", "En trabajo", "entero"], ["cliente", "Esperando al cliente", "entero"],
        ...(fz === "test" ? [["devoluciones", "Devoluciones al desarrollador", "entero"] as [string, string, "entero"]] : []),
        ["atrasados", "Atrasados", "entero"], ["externo", "Atraso externo (cliente y pausas anteriores)", "entero"],
        ["por_dev", "Atraso por devoluciones", "entero"], ["pausa", "Pausa sin motivo", "entero"], ["ejec", "Atraso por ejecución", "entero"],
        ["ayer", "Horas ayer", "horas"], ["trab", "Horas trabajadas (con presupuesto)", "horas"], ["presu", "Horas presupuestadas", "horas"],
        ["usadas", "Horas usadas", "pct"], ["excedidos", "SGR excedidos en horas", "entero"], ["sin_sgr", "Sin SGR asignado", "texto"]),
      filas: personas.map((p) => ({
        persona: p.nombre, usuario: p.usuario, lider: p.lider, sgr: p.r.sgr, activo: p.r.porEtapa.activo, cliente: p.r.esperandoCliente,
        devoluciones: p.r.devoluciones, atrasados: p.r.atrasados, externo: p.r.causas.pausas + p.r.causas.cliente, por_dev: p.r.causas.devoluciones,
        pausa: p.r.causas.pausa, ejec: p.r.causas.ejecucion, ayer: p.r.horasAyer, trab: p.r.trabConPresu, presu: p.r.presuConTrab,
        usadas: p.r.presuConTrab ? p.r.trabConPresu / p.r.presuConTrab : null, excedidos: p.r.excedidos, sin_sgr: p.sinAsignacion ? "Sí" : "No",
      })),
    }) },
  ];
  if (fz === "test") regiones.push({ id: "devoluciones", titulo: "Devoluciones al desarrollador", construir: async () => una({
    id: "devoluciones", titulo: "Devoluciones al desarrollador",
    columnas: cols(["grupo", "Devoluciones", "texto"], ["sgr", "SGR", "entero"], ["atrasados", "Con atraso", "entero"],
      ["atraso", "Atraso mediano (días hábiles)", "dias"], ["consumo", "Horas de testing usadas", "pct"]),
    filas: porDevolucionesTesting(items).map((x) => ({ grupo: ETIQUETA_DEVOLUCIONES[x.g], sgr: x.n, atrasados: x.atrasados, atraso: x.atraso, consumo: x.consumo })),
  }) });
  regiones.push({ id: "detalle", titulo: "Detalle de SGR", construir: async () => una({
    id: "detalle", titulo: "Detalle de SGR", columnas: colsDetalleSeg,
    filas: ordenar(items.filter((a) => a.etapa !== "sin_asignacion")).map(filaSeg),
  }) });
  return regiones;
}

function paginaTablero(items: Analisis[]): DefRegion[] {
  return [{ id: "tablero", titulo: "Tablero del equipo", construir: async () => {
    const filas: Record<string, unknown>[] = [];
    for (const fz of ["desa", "test"] as const) {
      for (const p of agruparPorPersona(items.filter((a) => a.fase === fz)).sort((a, b) => a.lider.localeCompare(b.lider) || a.nombre.localeCompare(b.nombre))) {
        const sgr = ordenar(p.items.filter((a) => a.etapa !== "sin_asignacion"));
        if (!sgr.length) filas.push({ fase: FASE[fz], lider: p.lider, persona: p.nombre, ayer: p.r.horasAyer, sgr: "Sin SGR asignado" });
        for (const a of sgr) filas.push({
          fase: FASE[fz], lider: a.lider, persona: p.nombre, ayer: p.r.horasAyer, sgr: a.id_req, asunto: a.asunto,
          situacion: SITUACIONES[a.situacion].nombre, etapa: ETAPAS[a.etapa].nombre, entrega: a.entregaCorregida ?? a.entrega_estimada,
          atraso: a.atraso, causa: a.causaPrincipal ? CAUSAS[a.causaPrincipal].nombre : null, devoluciones: a.devoluciones,
        });
      }
    }
    return una({
      id: "tablero", titulo: "Tablero del equipo",
      columnas: cols(["fase", "Fase", "texto"], ["lider", "Líder", "texto"], ["persona", "Persona", "texto"], ["ayer", "Horas cargadas ayer (persona)", "horas"],
        ["sgr", "SGR", "texto"], ["asunto", "Asunto", "texto"], ["situacion", "Situación", "texto"], ["etapa", "Etapa", "texto"],
        ["entrega", "Entrega corregida", "fecha"], ["atraso", "Atraso (días hábiles)", "entero"], ["causa", "Causa principal", "texto"],
        ["devoluciones", "Devoluciones al desarrollador", "entero"]),
      filas,
    });
  } }];
}

// ===========================================================================

/** Arma la definición de la pantalla según su ruta, con los filtros de la URL. */
export async function paginaExcel(ruta: string, sp: SearchParams): Promise<PaginaExcel | null> {
  const historicas: Record<string, { titulo: (f: Filtros) => string; regiones: (f: Filtros) => DefRegion[] }> = {
    "/": { titulo: (f) => `Resumen ${textoAnios(f)}`, regiones: paginaResumen },
    "/desarrollo": { titulo: (f) => `Desarrollo ${textoAnios(f)}`, regiones: (f) => paginaFase("desa", f) },
    "/testing": { titulo: (f) => `Testing ${textoAnios(f)}`, regiones: (f) => paginaFase("test", f) },
    "/tiempos": { titulo: (f) => `Tiempos y devoluciones ${textoAnios(f)}`, regiones: paginaTiempos },
    "/desglose": { titulo: (f) => `Por área y tipo ${textoAnios(f)}`, regiones: paginaDesglose },
    "/facturacion": { titulo: (f) => `Facturación ${textoAnios(f)}`, regiones: paginaFacturacion },
    "/requerimientos": { titulo: (f) => `Requerimientos ${textoAnios(f)}`, regiones: paginaRequerimientos },
  };
  if (historicas[ruta]) {
    const { f, meta } = await contextoHistorico(sp);
    return { titulo: historicas[ruta].titulo(f), meta, regiones: historicas[ruta].regiones(f) };
  }
  const enCurso: Record<string, { titulo: string; fase?: Fase; regiones: (items: Analisis[]) => DefRegion[] }> = {
    "/en-curso": { titulo: "Requerimientos en curso", regiones: paginaEnCurso },
    "/en-curso/desarrollo": { titulo: "Desarrollo en curso", fase: "desa", regiones: (i) => paginaSeguimientoFase("desa", i) },
    "/en-curso/testing": { titulo: "Testing en curso", fase: "test", regiones: (i) => paginaSeguimientoFase("test", i) },
    "/en-curso/equipo": { titulo: "Tablero del equipo", regiones: paginaTablero },
  };
  const def = enCurso[ruta];
  if (!def) return null;
  const ctx = await contextoSeguimiento(sp);
  const filtros: FiltrosSeguimiento = def.fase ? { ...ctx.f, fases: [] } : ctx.f;
  const base = def.fase ? ctx.analisis.filter((a) => a.fase === def.fase) : ctx.analisis;
  return { titulo: def.titulo, meta: ctx.meta, regiones: def.regiones(aplicarFiltros(base, filtros)) };
}

function memo<T>(fn: () => Promise<T>) {
  let p: Promise<T> | null = null;
  return () => (p ??= fn());
}
