// Análisis de los requerimientos EN CURSO (sin dependencias de servidor).
//
// Todo se cuenta en DÍAS HÁBILES: de lunes a viernes, sin los feriados cargados.
// Atraso: días hábiles posteriores a la entrega estimada ORIGINAL hasta la fecha de
// corte (o la fecha en que la fase se dio por finalizada). Se descompone en causas:
//
//   1. Pausas: horas pausadas de la fase (pausas de la fase + otras pausas) ÷ 8,
//      en días hábiles. Corren la entrega a la "entrega corregida". Las horas
//      pausadas incluyen la detención actual. Si hoy el SGR está detenido, la parte
//      de esas pausas que corresponde a la detención actual (días hábiles en el
//      estado) se atribuye a su motivo: espera del cliente, devolución de testing o
//      pausa sin motivo. El resto queda como "pausas anteriores".
//   2. En testing, si el SGR tuvo devoluciones al desarrollador, el atraso restante se
//      atribuye a esas devoluciones (el tester espera la corrección del desarrollador).
//   3. Ejecución: el resto del atraso, que no explican las anteriores.
//
// Los SGR en análisis o presupuesto (incluido "Presupuesto Aprobado") no cuentan como
// vencidos: son casos en que se vuelve a analizar el alcance y cambia el presupuesto.
import type { FilaSeguimiento } from "./planilla-seguimiento";

export type Etapa =
  | "planificacion" | "cola" | "activo" | "cliente" | "devuelto" | "pausa" | "finalizado" | "sin_asignacion" | "otro";

export const ETAPAS: Record<Etapa, { nombre: string; clase: string; color: string }> = {
  planificacion: { nombre: "Análisis y presupuesto", clase: "e-neutro", color: "var(--tinta-3)" },
  cola: { nombre: "En cola", clase: "e-neutro", color: "#8a94a8" },
  activo: { nombre: "En trabajo", clase: "e-desa", color: "var(--desa)" },
  cliente: { nombre: "Esperando al cliente", clase: "e-leve", color: "var(--leve)" },
  devuelto: { nombre: "Devuelto al desarrollador", clase: "e-test", color: "var(--test)" },
  pausa: { nombre: "En pausa", clase: "e-neutro", color: "#a58f6a" },
  finalizado: { nombre: "Fase finalizada", clase: "e-bien", color: "var(--bien)" },
  sin_asignacion: { nombre: "Sin asignación", clase: "e-neutro", color: "var(--tinta-3)" },
  otro: { nombre: "Otro estado", clase: "e-neutro", color: "var(--tinta-3)" },
};
export const ORDEN_ETAPAS: Etapa[] = ["planificacion", "cola", "activo", "cliente", "devuelto", "pausa", "finalizado", "otro"];

/** Clasifica el estado del sistema en una etapa. Por palabras clave, para tolerar estados nuevos. */
export function etapaDe(estado: string | null): Etapa {
  const e = (estado ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!e) return "otro";
  if (e.includes("sin asignacion")) return "sin_asignacion";
  if (e.includes("devuelto al desarrollador")) return "devuelto";
  if (e.includes("aguardando retorno") || e.includes("uat") || e.includes("cambios en requerimiento")) return "cliente";
  if (e.includes("pausa")) return "pausa";
  if (e.includes("finalizado")) return "finalizado";
  if (e.includes("iniciado") || e.includes("en curso")) return "activo";
  if (e.startsWith("para ")) return "cola";
  if (e.includes("presupuesto") || e.includes("analisis")) return "planificacion";
  return "otro";
}

export type Causa = "pausas" | "cliente" | "devoluciones" | "pausa" | "ejecucion";
export const CAUSAS: Record<Causa, { nombre: string; color: string; externa: boolean; ayuda: string }> = {
  pausas: { nombre: "Pausas anteriores", color: "#8a94a8", externa: true,
    ayuda: "Días que el sistema corrió la entrega por pausas de estados anteriores (8 h pausadas = 1 día)." },
  cliente: { nombre: "Espera del cliente", color: "var(--leve)", externa: true,
    ayuda: "Pausa de la detención actual esperando al cliente: Aguardando retorno FPJ, pruebas UAT o cambios en el requerimiento." },
  devoluciones: { nombre: "Devoluciones de testing", color: "var(--test)", externa: false,
    ayuda: "Atraso por devoluciones de testing al desarrollador (actualización de fuentes o errores encontrados)." },
  pausa: { nombre: "Pausa sin motivo registrado", color: "#a58f6a", externa: false,
    ayuda: "Pausa de la detención actual en un estado que no indica si se espera al cliente (Testing en Pausa)." },
  ejecucion: { nombre: "Ejecución", color: "var(--mal)", externa: false,
    ayuda: "Atraso que no explican las pausas ni las devoluciones: lentitud o subestimación." },
};
export const ORDEN_CAUSAS: Causa[] = ["pausas", "cliente", "devoluciones", "pausa", "ejecucion"];

export type Ejecucion = "horas" | "ritmo" | "sin_iniciar";
export const EJECUCION: Record<Ejecucion, { nombre: string; ayuda: string }> = {
  horas: { nombre: "Más horas que las presupuestadas",
    ayuda: "Se trabajaron más horas de las presupuestadas: subestimación o ineficiencia." },
  ritmo: { nombre: "Ritmo por debajo del plan",
    ayuda: "Se usaron menos horas de las presupuestadas pero se pasó la fecha: poca dedicación diaria o trabajo en paralelo." },
  sin_iniciar: { nombre: "No iniciado o en cola",
    ayuda: "La fecha venció sin que el SGR empezara a trabajarse (en cola o sin horas cargadas)." },
};

export type Situacion = "atrasado" | "vence_pronto" | "en_plazo" | "sin_plan" | "replanificacion" | "fin_tarde" | "fin_a_tiempo" | "sin_asignacion";
export const SITUACIONES: Record<Situacion, { nombre: string; clase: string }> = {
  atrasado: { nombre: "Atrasado", clase: "e-mal" },
  vence_pronto: { nombre: "Vence en 3 días o menos", clase: "e-leve" },
  en_plazo: { nombre: "En plazo", clase: "e-bien" },
  sin_plan: { nombre: "Sin fecha comprometida", clase: "e-neutro" },
  replanificacion: { nombre: "En análisis de alcance", clase: "e-neutro" },
  fin_tarde: { nombre: "Terminó con atraso", clase: "e-leve" },
  fin_a_tiempo: { nombre: "Terminó en plazo", clase: "e-bien" },
  sin_asignacion: { nombre: "Sin SGR asignado", clase: "e-neutro" },
};

export type Analisis = FilaSeguimiento & {
  lider: string;
  etapa: Etapa;
  situacion: Situacion;
  diasEnEstado: number | null;
  atraso: number | null;
  causas: Record<Causa, number>;
  causaPrincipal: Causa | null;
  /** horas trabajadas ÷ presupuestadas */
  consumo: number | null;
  /** días transcurridos (sin pausas) ÷ días planificados, solo con fechas de plan */
  avance: number | null;
  /** Entrega estimada corrida por las pausas, en días hábiles. */
  entregaCorregida: string | null;
  /** Sub-diagnóstico del atraso por ejecución */
  ejecucion: Ejecucion | null;
  horasExcedidas: number;
  /** Días hábiles de la detención actual que no figuran en las horas pausadas (dato a revisar). */
  pausaSinRegistrar: number;
  /** Solo testing: desarrollador reconocido en la planilla de desarrollo (usuario), o null. */
  devUsuario: string | null;
  /** Solo testing: nombre del desarrollador para mostrar. */
  devNombre: string | null;
  /** Solo testing: el desarrollo es del cliente (SGR sin importe de desarrollo). */
  devExterno: boolean;
};

const DIA = 86_400_000;
const fecha = (s: string | null) => (s ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Fechas de feriados ('AAAA-MM-DD'). */
export type Feriados = Set<string>;

function esHabil(t: number, fer: Feriados) {
  const d = new Date(t).getUTCDay();
  return d !== 0 && d !== 6 && !fer.has(iso(t));
}
/** Días hábiles entre dos fechas, ambas inclusive (0 si el rango está vacío). */
export function habiles(desde: number, hasta: number, fer: Feriados) {
  let n = 0;
  for (let t = desde; t <= hasta; t += DIA) if (esHabil(t, fer)) n++;
  return n;
}
/** Días hábiles posteriores a "desde" hasta "hasta" inclusive. */
const habilesDespues = (desde: number, hasta: number, fer: Feriados) => habiles(desde + DIA, hasta, fer);
/** La fecha que resulta de sumar n días hábiles a otra. */
export function sumarHabiles(desde: number, n: number, fer: Feriados) {
  let t = desde;
  for (let k = 0; k < n; ) { t += DIA; if (esHabil(t, fer)) k++; }
  return t;
}

export function analizar(f: FilaSeguimiento, corteIso: string, lideres: Set<string>, fer: Feriados = new Set()): Analisis {
  const C = fecha(corteIso)!;
  const E = fecha(f.entrega_estimada);
  const I = fecha(f.fecha_inicio);
  const S = fecha(f.fecha_estado);
  // Pausas de la fase en días hábiles (8 h = 1 día) y entrega corregida.
  const diasPausa = (f.horas_pausadas_fase + f.otras_horas_pausadas) / 8;
  const corrido = Math.round(diasPausa);
  const N = E != null ? sumarHabiles(E, corrido, fer) : null;
  const entregaCorregida = N != null ? iso(N) : null;
  const etapa = f.id_req === "0" ? "sin_asignacion" : etapaDe(f.estado);
  const lider = f.team_leader ?? (lideres.has(f.usuario) ? f.usuario : "Sin líder");
  const causas: Record<Causa, number> = { pausas: 0, cliente: 0, devoluciones: 0, pausa: 0, ejecucion: 0 };
  const consumo = f.horas_presu && f.horas_presu > 0 ? f.horas_trab / f.horas_presu : null;
  const horasExcedidas = f.horas_presu != null && f.horas_trab > f.horas_presu ? f.horas_trab - f.horas_presu : 0;
  const diasEnEstado = S != null ? habilesDespues(S, C, fer) : null;

  const detenido = etapa === "cliente" || etapa === "devuelto" || etapa === "pausa";
  const pausaSinRegistrar = detenido && S != null
    ? Math.max(0, Math.floor(habilesDespues(S, C, fer) - diasPausa)) : 0;
  const base = { ...f, lider, etapa, diasEnEstado, causas, consumo, horasExcedidas, pausaSinRegistrar, entregaCorregida,
    devUsuario: null, devNombre: f.desarrollador ?? null, devExterno: (f.importe_desa ?? 0) === 0 };
  if (etapa === "sin_asignacion") {
    return { ...base, situacion: "sin_asignacion", atraso: null, causaPrincipal: null, avance: null, ejecucion: null };
  }

  let avance: number | null = null;
  if (I != null && E != null && E >= I) {
    const plan = Math.max(1, habiles(I, E, fer));
    const hasta = S != null && etapa === "finalizado" ? Math.min(S, C) : C;
    avance = Math.max(0, habiles(I, hasta, fer) - corrido) / plan;
  }

  if (E == null) {
    return { ...base, situacion: "sin_plan", atraso: null, causaPrincipal: null, avance, ejecucion: null };
  }
  // En análisis o presupuesto se revisa el alcance y cambia el presupuesto: la fecha no está vigente.
  if (etapa === "planificacion") {
    return { ...base, situacion: "replanificacion", atraso: null, causaPrincipal: null, avance: null, ejecucion: null };
  }

  const finalizado = etapa === "finalizado";
  const ref = finalizado && S != null ? S : C;
  const atraso = habilesDespues(E, ref, fer);
  let resto = atraso;

  // 1. Pausas registradas (ya incluyen la detención actual).
  const pausas = Math.min(resto, corrido);
  resto -= pausas;
  // La parte que corresponde a la detención actual se atribuye a su motivo.
  let actual = 0;
  if (!finalizado && S != null && (etapa === "cliente" || etapa === "devuelto" || etapa === "pausa")) {
    actual = Math.min(pausas, habilesDespues(S, C, fer));
    causas[etapa === "cliente" ? "cliente" : etapa === "devuelto" ? "devoluciones" : "pausa"] += actual;
  }
  causas.pausas = pausas - actual;

  // 2. En testing, el resto se debe a las devoluciones al desarrollador, si las hubo.
  if (resto > 0 && f.fase === "test" && (f.devoluciones ?? 0) > 0) {
    causas.devoluciones += resto;
    resto = 0;
  }

  // 3. Ejecución.
  causas.ejecucion = resto;
  const ejecucion: Ejecucion | null = resto <= 0 ? null
    : f.horas_trab === 0 || etapa === "cola" ? "sin_iniciar"
    : consumo != null && consumo > 1 ? "horas" : "ritmo";

  let causaPrincipal: Causa | null = null;
  for (const c of ORDEN_CAUSAS) if (causas[c] > 0 && (causaPrincipal == null || causas[c] > causas[causaPrincipal])) causaPrincipal = c;

  let situacion: Situacion;
  if (finalizado) situacion = atraso > 0 ? "fin_tarde" : "fin_a_tiempo";
  else if (atraso > 0) situacion = "atrasado";
  else if (N != null && habilesDespues(C, N, fer) <= 3) situacion = "vence_pronto";
  else situacion = "en_plazo";

  return { ...base, situacion, atraso, causaPrincipal, avance, ejecucion };
}

/** Personas que figuran como líder de otras: sus propias filas (sin líder) quedan en su equipo. */
export function lideresDe(filas: FilaSeguimiento[]) {
  return new Set(filas.map((f) => f.team_leader).filter((x): x is string => !!x));
}

export type ResumenGrupo = {
  sgr: number;
  porEtapa: Record<Etapa, number>;
  atrasados: number;
  diasAtraso: number;
  causas: Record<Causa, number>;
  esperandoCliente: number;
  devoluciones: number;
  sgrConDevolucion: number;
  devueltosAhora: number;
  horasAyer: number;
  horasTrab: number;
  horasPresu: number;
  /** solo SGR con presupuesto y horas cargadas, para el consumo */
  trabConPresu: number;
  presuConTrab: number;
  excedidos: number;
  horasExcedidas: number;
  sinPlan: number;
  enAnalisis: number;
  pausasSinRegistrar: number;
  importe: number;
};

export function resumir(items: Analisis[]): ResumenGrupo {
  const r: ResumenGrupo = {
    sgr: 0, porEtapa: Object.fromEntries(Object.keys(ETAPAS).map((k) => [k, 0])) as Record<Etapa, number>,
    atrasados: 0, diasAtraso: 0, causas: { pausas: 0, cliente: 0, devoluciones: 0, pausa: 0, ejecucion: 0 },
    esperandoCliente: 0, devoluciones: 0, sgrConDevolucion: 0, devueltosAhora: 0, horasAyer: 0, horasTrab: 0, horasPresu: 0,
    trabConPresu: 0, presuConTrab: 0, excedidos: 0, horasExcedidas: 0, sinPlan: 0, enAnalisis: 0, pausasSinRegistrar: 0, importe: 0,
  };
  for (const a of items) {
    r.horasAyer += a.horas_ayer;
    if (a.etapa === "sin_asignacion") continue;
    r.sgr++;
    r.porEtapa[a.etapa]++;
    if (a.situacion === "atrasado") r.atrasados++;
    if (a.situacion === "sin_plan") r.sinPlan++;
    if (a.situacion === "replanificacion") r.enAnalisis++;
    if (a.pausaSinRegistrar > 1) r.pausasSinRegistrar++;
    if (a.atraso && a.etapa !== "finalizado") {
      r.diasAtraso += a.atraso;
      for (const c of ORDEN_CAUSAS) r.causas[c] += a.causas[c];
    }
    if (a.etapa === "cliente") r.esperandoCliente++;
    if (a.etapa === "devuelto") r.devueltosAhora++;
    r.devoluciones += a.devoluciones ?? 0;
    if ((a.devoluciones ?? 0) > 0) r.sgrConDevolucion++;
    r.horasTrab += a.horas_trab;
    r.horasPresu += a.horas_presu ?? 0;
    if (a.horas_presu && a.horas_trab > 0) { r.trabConPresu += a.horas_trab; r.presuConTrab += a.horas_presu; }
    if (a.horasExcedidas > 0) { r.excedidos++; r.horasExcedidas += a.horasExcedidas; }
    r.importe += a.importe_total ?? 0;
  }
  return r;
}

export function mediana(v: number[]) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type GrupoPersona = { usuario: string; nombre: string; lider: string; r: ResumenGrupo; items: Analisis[]; sinAsignacion: boolean };

/** Agrupa por persona, de mayor a menor atraso. */
export function agruparPorPersona(items: Analisis[]): GrupoPersona[] {
  return [...new Set(items.map((a) => a.usuario))].map((u) => {
    const propios = items.filter((a) => a.usuario === u);
    return { usuario: u, nombre: propios[0].nombre ?? u, lider: propios[0].lider, r: resumir(propios), items: propios,
      sinAsignacion: propios.some((a) => a.etapa === "sin_asignacion") };
  }).sort((a, b) => b.r.diasAtraso - a.r.diasAtraso || b.r.sgr - a.r.sgr);
}

/** Devoluciones de testing agrupadas: 0, 1, 2, 3 o más. */
export function porDevolucionesTesting(items: Analisis[]) {
  return [0, 1, 2, 3].map((g) => {
    const l = items.filter((a) => a.etapa !== "sin_asignacion" && Math.min(a.devoluciones ?? 0, 3) === g);
    const conHoras = l.filter((a) => a.horas_presu && a.horas_trab > 0);
    const trab = conHoras.reduce((s, a) => s + a.horas_trab, 0), presu = conHoras.reduce((s, a) => s + (a.horas_presu ?? 0), 0);
    return { g, n: l.length, atrasados: l.filter((a) => a.situacion === "atrasado" || a.situacion === "fin_tarde").length,
      atraso: mediana(l.filter((a) => a.atraso != null).map((a) => a.atraso!)), consumo: presu ? trab / presu : null };
  }).filter((x) => x.n > 0);
}
export const ETIQUETA_DEVOLUCIONES = ["Sin devoluciones", "1 devolución", "2 devoluciones", "3 o más"];

/** Utilidades de fecha para otros módulos. */
export const fechaMs = fecha;
export const aIso = iso;

export type DevolucionesDesarrollador = {
  clave: string;
  usuario: string | null;
  nombre: string;
  externo: boolean;
  sgr: number;
  sgrConDevolucion: number;
  devoluciones: number;
  devueltosAhora: number;
  /** Días hábiles de atraso de testing atribuidos a devoluciones de este desarrollador. */
  atraso: number;
};

/** Devoluciones de testing agrupadas por el desarrollador del SGR (columna Desarrollador del CSV de testing). */
export function devolucionesPorDesarrollador(itemsTesting: Analisis[]): DevolucionesDesarrollador[] {
  const mapa = new Map<string, DevolucionesDesarrollador>();
  for (const a of itemsTesting) {
    if (a.fase !== "test" || !a.devNombre || a.etapa === "sin_asignacion") continue;
    const externo = a.devExterno;
    const clave = a.devUsuario ?? `${externo ? "cliente" : "onnix"}:${a.devNombre.toLowerCase()}`;
    const d = mapa.get(clave) ?? { clave, usuario: a.devUsuario, nombre: a.devNombre, externo, sgr: 0, sgrConDevolucion: 0, devoluciones: 0, devueltosAhora: 0, atraso: 0 };
    d.sgr++;
    d.devoluciones += a.devoluciones ?? 0;
    if ((a.devoluciones ?? 0) > 0) d.sgrConDevolucion++;
    if (a.etapa === "devuelto") d.devueltosAhora++;
    if (a.etapa !== "finalizado") d.atraso += a.causas.devoluciones;
    mapa.set(clave, d);
  }
  return [...mapa.values()].sort((a, b) => Number(a.externo) - Number(b.externo) || b.devoluciones - a.devoluciones || b.atraso - a.atraso);
}
