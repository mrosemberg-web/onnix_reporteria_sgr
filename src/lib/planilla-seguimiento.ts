// Lectura de las planillas de seguimiento de requerimientos en curso:
// Seguimiento_desa.csv (mirada de desarrollo) y Seguimiento_testing.csv (mirada de testing).
import { normalizarEncabezado, parsearCsv, parsearFecha, parsearNumero } from "./planilla";

export type TipoPlanilla = "facturacion" | "seguimiento_desa" | "seguimiento_test" | "resumen_horas";

export const NOMBRE_TIPO: Record<TipoPlanilla, string> = {
  facturacion: "Facturación por período",
  seguimiento_desa: "Seguimiento de desarrollo (en curso)",
  seguimiento_test: "Seguimiento de testing (en curso)",
  resumen_horas: "Resumen de horas",
};

export function matrizCsv(txt: string): string[][] {
  const primera = txt.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  return parsearCsv(txt, sep);
}

/** Reconoce el tipo de planilla por sus encabezados. */
export function detectarTipo(encabezados: string[]): TipoPlanilla | null {
  const h = new Set(encabezados.map(normalizarEncabezado));
  if (h.has("id req") && h.has("total a facturar")) return "facturacion";
  if (h.has("nro sgr") && h.has("horas trab desa total")) return "seguimiento_desa";
  if (h.has("nro sgr") && h.has("horas trab test")) return "seguimiento_test";
  if (h.has("id usuario") && h.has("horas trabajadas") && h.has("potencial horas")) return "resumen_horas";
  return null;
}

export type FilaSeguimiento = {
  fase: "desa" | "test";
  id_req: string;
  usuario: string;
  nombre: string | null;
  team_leader: string | null;
  asunto: string | null;
  estado: string | null;
  tipo_servicio: string | null;
  equipo: string | null;
  fecha_estado: string | null;
  devoluciones: number | null;
  fecha_inicio: string | null;
  horas_ayer: number;
  horas_trab: number;
  horas_presu: number | null;
  entrega_estimada: string | null;
  horas_pausadas_fase: number;
  nueva_entrega: string | null;
  otras_horas_pausadas: number;
  total_horas_pausadas: number;
  importe_desa: number | null;
  importe_test: number | null;
  importe_total: number | null;
  /** Solo testing, opcional: quién desarrolló el SGR (de Onnix o del cliente). */
  desarrollador: string | null;
};

export const COLUMNAS_SEGUIMIENTO: (keyof FilaSeguimiento)[] = [
  "fase", "id_req", "usuario", "nombre", "team_leader", "asunto", "estado", "tipo_servicio", "equipo",
  "fecha_estado", "devoluciones", "fecha_inicio", "horas_ayer", "horas_trab", "horas_presu", "entrega_estimada",
  "horas_pausadas_fase", "nueva_entrega", "otras_horas_pausadas", "total_horas_pausadas",
  "importe_desa", "importe_test", "importe_total", "desarrollador",
];

type Tipo = "texto" | "fecha" | "num" | "num0" | "entero";
type Col = { col: keyof FilaSeguimiento; enc: Record<"desa" | "test", string | string[] | null>; tipo: Tipo; requerida: boolean };

// num: vacío = sin dato (null). num0: vacío = 0.
const COLS: Col[] = [
  { col: "usuario", enc: { desa: "usuario", test: "usuario" }, tipo: "texto", requerida: true },
  { col: "nombre", enc: { desa: "nombres", test: "nombres" }, tipo: "texto", requerida: false },
  { col: "team_leader", enc: { desa: "team leader", test: "team leader" }, tipo: "texto", requerida: false },
  { col: "id_req", enc: { desa: "nro sgr", test: "nro sgr" }, tipo: "texto", requerida: true },
  { col: "asunto", enc: { desa: "asunto", test: "asunto" }, tipo: "texto", requerida: false },
  { col: "estado", enc: { desa: "estado", test: "estado" }, tipo: "texto", requerida: true },
  { col: "tipo_servicio", enc: { desa: "tipo servicio", test: "tipo servicio" }, tipo: "texto", requerida: false },
  { col: "equipo", enc: { desa: "equipo", test: "equipo" }, tipo: "texto", requerida: false },
  { col: "fecha_estado", enc: { desa: "fecha estado", test: "fecha estado" }, tipo: "fecha", requerida: true },
  { col: "devoluciones", enc: { desa: null, test: "total devoluciones" }, tipo: "entero", requerida: true },
  { col: "fecha_inicio", enc: { desa: "fecha inicio desa", test: "fecha inicio test" }, tipo: "fecha", requerida: true },
  { col: "horas_ayer", enc: { desa: "horas trab desa ayer", test: "horas trab testing ayer" }, tipo: "num0", requerida: false },
  { col: "horas_trab", enc: { desa: "horas trab desa total", test: "horas trab test" }, tipo: "num0", requerida: true },
  { col: "horas_presu", enc: { desa: "horas presu desa", test: "horas presu test" }, tipo: "num", requerida: true },
  { col: "entrega_estimada", enc: { desa: "entrega estimada desa", test: "entrega estimada test" }, tipo: "fecha", requerida: true },
  { col: "horas_pausadas_fase", enc: { desa: "horas pausadas desa", test: "horas pausadas test" }, tipo: "num0", requerida: false },
  { col: "nueva_entrega", enc: { desa: "nueva entrega estimada desa", test: "nueva entrega estimada test" }, tipo: "fecha", requerida: true },
  { col: "otras_horas_pausadas", enc: { desa: "otras horas pausadas", test: "otras horas pausadas" }, tipo: "num0", requerida: false },
  { col: "total_horas_pausadas", enc: { desa: "total horas pausadas", test: "total horas pausadas" }, tipo: "num0", requerida: false },
  { col: "importe_desa", enc: { desa: "importe fact desa", test: "importe fact desa" }, tipo: "num", requerida: false },
  { col: "importe_test", enc: { desa: "importe fact test", test: "importe fact test" }, tipo: "num", requerida: false },
  { col: "importe_total", enc: { desa: "importe fact total", test: "importe fact total" }, tipo: "num", requerida: false },
  { col: "desarrollador", tipo: "texto", requerida: false, enc: { desa: null,
    test: ["desarrollador", "usuario desarrollador", "desarrollador asignado", "asignado a desarrollo", "asignado desarrollo", "responsable desarrollo"] } },
];

export function leerSeguimiento(txt: string, fase: "desa" | "test") {
  const advertencias: string[] = [];
  const errores: string[] = [];
  const matriz = matrizCsv(txt);
  if (matriz.length < 2) return { filas: [] as FilaSeguimiento[], advertencias, errores: ["El archivo no tiene filas de datos."] };

  const enc = matriz[0].map(normalizarEncabezado);
  const indice = new Map<keyof FilaSeguimiento, number>();
  for (const c of COLS) {
    const nombres = c.enc[fase];
    if (!nombres) continue;
    const candidatos = Array.isArray(nombres) ? nombres : [nombres];
    const i = enc.findIndex((h) => candidatos.includes(h));
    if (i >= 0) indice.set(c.col, i);
    else if (c.requerida) errores.push(`Falta la columna "${candidatos[0]}".`);
  }
  if (errores.length) return { filas: [], advertencias, errores };

  const vistos = new Set<string>();
  const filas: FilaSeguimiento[] = [];
  for (let n = 1; n < matriz.length; n++) {
    const celdas = matriz[n];
    const linea = n + 1;
    const fila: Record<string, unknown> = { fase };
    for (const c of COLS) {
      const i = indice.get(c.col);
      const crudo = i === undefined ? "" : (celdas[i] ?? "").trim();
      if (c.tipo === "texto") fila[c.col] = crudo === "" ? null : crudo;
      else if (c.tipo === "fecha") {
        const f = parsearFecha(crudo);
        if (f === undefined) { advertencias.push(`Línea ${linea}: fecha "${crudo}" inválida; se dejó vacía.`); fila[c.col] = null; }
        else fila[c.col] = f;
      } else {
        if (crudo === "" && c.tipo === "num") { fila[c.col] = null; continue; }
        if (crudo === "" && c.tipo === "entero" && i === undefined) { fila[c.col] = null; continue; }
        const v = parsearNumero(crudo);
        if (v === null) { advertencias.push(`Línea ${linea}: "${crudo}" no es un número válido; se tomó vacío.`); fila[c.col] = c.tipo === "num" ? null : 0; }
        else fila[c.col] = c.tipo === "entero" ? Math.round(v) : v;
      }
    }
    if (fase === "desa") { fila.devoluciones = null; fila.desarrollador = null; }
    const f = fila as FilaSeguimiento;
    if (!f.usuario || !f.id_req) { advertencias.push(`Línea ${linea}: sin usuario o sin Nro Sgr; se omitió.`); continue; }
    if (f.id_req !== "0") {
      if (vistos.has(f.id_req)) advertencias.push(`SGR ${f.id_req} repetido (línea ${linea}); se cargan ambas filas.`);
      vistos.add(f.id_req);
    }
    filas.push(f);
  }
  return { filas, advertencias, errores };
}

// ---------------------------------------------------------------------------
// Planilla «Resumen de horas»: una fila por persona con sus horas del período.
// ---------------------------------------------------------------------------
export type FilaHoras = {
  usuario: string;
  equipo: string | null;
  team_leader: string | null;
  periodo: string | null;
  horas_trabajadas: number | null;
  dias_habiles: number | null;
  potencial: number | null;
  diferencia: number | null;
};
export const COLUMNAS_HORAS: (keyof FilaHoras)[] = ["usuario", "equipo", "team_leader", "periodo", "horas_trabajadas", "dias_habiles", "potencial", "diferencia"];

export function leerResumenHoras(txt: string) {
  const advertencias: string[] = [];
  const errores: string[] = [];
  const matriz = matrizCsv(txt);
  if (matriz.length < 2) return { filas: [] as FilaHoras[], advertencias, errores: ["El archivo no tiene filas de datos."] };
  const enc = matriz[0].map(normalizarEncabezado);
  const col = (n: string) => enc.indexOf(n);
  const idx = { usuario: col("id usuario"), equipo: col("equipo"), team_leader: col("team leader"), periodo: col("periodo"),
    horas_trabajadas: col("horas trabajadas"), dias_habiles: col("dias habiles"), potencial: col("potencial horas"), diferencia: col("diferencia") };
  for (const [k, n] of [["usuario", "Id Usuario"], ["horas_trabajadas", "Horas Trabajadas"], ["potencial", "Potencial Horas"]] as const) {
    if (idx[k] < 0) errores.push(`Falta la columna "${n}".`);
  }
  if (errores.length) return { filas: [], advertencias, errores };
  const texto = (c: string[], i: number) => (i < 0 ? null : (c[i] ?? "").trim() || null);
  const numero = (c: string[], i: number, linea: number, nombre: string) => {
    const v = texto(c, i);
    if (v == null) return null;
    const n = parsearNumero(v);
    if (n == null) advertencias.push(`Línea ${linea}: "${v}" no es un número válido en "${nombre}"; se dejó vacío.`);
    return n;
  };
  const filas: FilaHoras[] = [];
  const vistos = new Set<string>();
  for (let n = 1; n < matriz.length; n++) {
    const c = matriz[n], linea = n + 1;
    const usuario = texto(c, idx.usuario);
    if (!usuario) { advertencias.push(`Línea ${linea}: sin «Id Usuario»; se omitió.`); continue; }
    if (vistos.has(usuario.toLowerCase())) advertencias.push(`Línea ${linea}: ${usuario} está repetido; se suman sus filas.`);
    vistos.add(usuario.toLowerCase());
    const periodo = texto(c, idx.periodo);
    if (periodo && !/^\d{4}\/\d{1,2}$/.test(periodo)) advertencias.push(`Línea ${linea}: período "${periodo}" con formato inesperado (se espera AAAA/MM).`);
    filas.push({
      usuario, equipo: texto(c, idx.equipo), team_leader: texto(c, idx.team_leader), periodo,
      horas_trabajadas: numero(c, idx.horas_trabajadas, linea, "Horas Trabajadas"),
      dias_habiles: numero(c, idx.dias_habiles, linea, "Dias Habiles"),
      potencial: numero(c, idx.potencial, linea, "Potencial Horas"),
      diferencia: numero(c, idx.diferencia, linea, "Diferencia"),
    });
  }
  const periodos = [...new Set(filas.map((f) => f.periodo).filter(Boolean))];
  if (periodos.length > 1) advertencias.push(`La planilla mezcla períodos (${periodos.join(", ")}); se toman todas las filas.`);
  return { filas, advertencias, errores };
}
