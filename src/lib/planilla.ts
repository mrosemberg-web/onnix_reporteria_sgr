// Lectura de la planilla "Facturación por período" (CSV separado por ; exportado del sistema de gestión).
// Sin dependencias de servidor para poder probarla de forma aislada.

export type FilaReq = {
  id_req: string;
  implementacion: string | null;
  departamento: string | null;
  solicitante: string | null;
  asunto: string | null;
  asignado_a: string | null;
  tipo_requerimiento: string | null;
  horas_desa: number;
  devoluciones: number;
  horas_pausadas_desa: number;
  horas_presu_desa: number;
  importe_desa: number;
  horas_test: number;
  horas_presu_test: number;
  importe_test: number;
  equipo: string | null;
  estado: string | null;
  fecha_facturacion: string | null;
  asignado_testing: string | null;
  fecha_inicio_desa: string | null;
  fecha_fin_desa: string | null;
  fecha_inicio_testing: string | null;
  fecha_fin_testing: string | null;
  horas_pausadas: number;
  horas_pausadas_test: number;
  total_facturar: number;
};

type Tipo = "texto" | "numero" | "entero" | "fecha" | "id";

// Encabezado de la planilla (normalizado) -> columna en la base.
const COLUMNAS: { col: keyof FilaReq; encabezados: string[]; tipo: Tipo; requerida: boolean }[] = [
  { col: "implementacion", encabezados: ["implementacion"], tipo: "fecha", requerida: true },
  { col: "departamento", encabezados: ["departamento"], tipo: "texto", requerida: false },
  { col: "solicitante", encabezados: ["solicitante"], tipo: "texto", requerida: false },
  { col: "id_req", encabezados: ["id req", "idreq", "id requerimiento", "sgr"], tipo: "id", requerida: true },
  { col: "asunto", encabezados: ["asunto"], tipo: "texto", requerida: false },
  { col: "asignado_a", encabezados: ["asignado a"], tipo: "texto", requerida: true },
  { col: "tipo_requerimiento", encabezados: ["tipo requerimiento"], tipo: "texto", requerida: false },
  { col: "horas_desa", encabezados: ["horas desa"], tipo: "numero", requerida: true },
  { col: "devoluciones", encabezados: ["devoluciones"], tipo: "entero", requerida: true },
  { col: "horas_pausadas_desa", encabezados: ["horas pausadas desa"], tipo: "numero", requerida: true },
  { col: "horas_presu_desa", encabezados: ["horas presu desa"], tipo: "numero", requerida: true },
  { col: "importe_desa", encabezados: ["importe desa"], tipo: "numero", requerida: false },
  { col: "horas_test", encabezados: ["horas test"], tipo: "numero", requerida: true },
  { col: "horas_presu_test", encabezados: ["horas presu test"], tipo: "numero", requerida: true },
  { col: "importe_test", encabezados: ["importe test"], tipo: "numero", requerida: false },
  { col: "equipo", encabezados: ["equipo"], tipo: "texto", requerida: true },
  { col: "estado", encabezados: ["estado"], tipo: "texto", requerida: false },
  { col: "fecha_facturacion", encabezados: ["fecha facturacion"], tipo: "fecha", requerida: false },
  { col: "asignado_testing", encabezados: ["asignado a testing"], tipo: "texto", requerida: true },
  { col: "fecha_inicio_desa", encabezados: ["fecha inicio desa"], tipo: "fecha", requerida: true },
  { col: "fecha_fin_desa", encabezados: ["fecha fin desa"], tipo: "fecha", requerida: true },
  { col: "fecha_inicio_testing", encabezados: ["fecha inicio testing"], tipo: "fecha", requerida: true },
  { col: "fecha_fin_testing", encabezados: ["fecha fin testing"], tipo: "fecha", requerida: true },
  { col: "horas_pausadas", encabezados: ["horas pausadas"], tipo: "numero", requerida: false },
  { col: "horas_pausadas_test", encabezados: ["horas pausadas test"], tipo: "numero", requerida: false },
  { col: "total_facturar", encabezados: ["total a facturar"], tipo: "numero", requerida: false },
];

export const COLUMNAS_DB = COLUMNAS.map((c) => c.col);

export type ResultadoLectura = {
  filas: FilaReq[];
  advertencias: string[];
  errores: string[];
};

/** Decodifica el archivo: UTF-8 si es válido, si no Windows-1252 (export típico de Excel en español). */
export function decodificar(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let txt: string;
  try {
    txt = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    txt = new TextDecoder("windows-1252").decode(bytes);
  }
  return txt.replace(/^\uFEFF/, "");
}

export function normalizarEncabezado(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

/** Parser CSV con soporte de comillas, separador configurable y saltos CRLF. */
export function parsearCsv(txt: string, sep: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"') {
        if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === "") comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((v) => v.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((v) => v.trim() !== "")) filas.push(fila);
  return filas;
}

/** Números en formato paraguayo: punto de miles y coma decimal ("1.800.000", "101,8", ",58"). */
export function parsearNumero(v: string): number | null {
  const s = v.trim().replace(/\s/g, "").replace(/^Gs\.?/i, "");
  if (s === "" || s === "-") return 0;
  if (!/^-?[\d.]*(,\d*)?$/.test(s)) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Fechas dd/mm/aaaa (o aaaa-mm-dd). Devuelve 'aaaa-mm-dd' o null si está vacía. */
export function parsearFecha(v: string): string | null | undefined {
  const s = v.trim();
  if (s === "") return null;
  let d: number, m: number, a: number;
  let r = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/);
  if (r) { d = +r[1]; m = +r[2]; a = +r[3]; }
  else if ((r = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { a = +r[1]; m = +r[2]; d = +r[3]; }
  else return undefined;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return undefined;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function leerPlanilla(txt: string): ResultadoLectura {
  const advertencias: string[] = [];
  const errores: string[] = [];
  const primera = txt.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const matriz = parsearCsv(txt, sep);
  if (matriz.length < 2) return { filas: [], advertencias, errores: ["El archivo no tiene filas de datos."] };

  const enc = matriz[0].map(normalizarEncabezado);
  const indice = new Map<keyof FilaReq, number>();
  for (const c of COLUMNAS) {
    const i = enc.findIndex((h) => c.encabezados.includes(h));
    if (i >= 0) indice.set(c.col, i);
    else if (c.requerida) errores.push(`Falta la columna "${c.encabezados[0]}".`);
    else advertencias.push(`No se encontró la columna "${c.encabezados[0]}"; se cargará vacía.`);
  }
  if (errores.length) return { filas: [], advertencias, errores };

  const porId = new Map<string, FilaReq>();
  for (let n = 1; n < matriz.length; n++) {
    const celdas = matriz[n];
    const linea = n + 1;
    const fila = {} as Record<string, unknown>;
    let valida = true;
    for (const c of COLUMNAS) {
      const i = indice.get(c.col);
      const crudo = i === undefined ? "" : (celdas[i] ?? "").trim();
      switch (c.tipo) {
        case "id":
          if (!crudo) { errores.push(`Línea ${linea}: falta "Id Req".`); valida = false; }
          fila[c.col] = crudo;
          break;
        case "texto":
          fila[c.col] = crudo === "" ? null : crudo;
          break;
        case "numero":
        case "entero": {
          const num = parsearNumero(crudo);
          if (num === null) {
            advertencias.push(`Línea ${linea}: "${crudo}" no es un número válido en "${c.encabezados[0]}"; se tomó 0.`);
            fila[c.col] = 0;
          } else fila[c.col] = c.tipo === "entero" ? Math.round(num) : num;
          break;
        }
        case "fecha": {
          const f = parsearFecha(crudo);
          if (f === undefined) {
            advertencias.push(`Línea ${linea}: fecha "${crudo}" inválida en "${c.encabezados[0]}"; se dejó vacía.`);
            fila[c.col] = null;
          } else fila[c.col] = f;
          break;
        }
      }
    }
    if (!valida) continue;
    const f = fila as FilaReq;
    if (!f.implementacion) advertencias.push(`Línea ${linea} (SGR ${f.id_req}): sin fecha de implementación; no aparecerá en los reportes por año.`);
    if (porId.has(f.id_req)) advertencias.push(`SGR ${f.id_req} repetido; se conservó la última fila (línea ${linea}).`);
    porId.set(f.id_req, f);
  }
  return { filas: [...porId.values()], advertencias, errores };
}
