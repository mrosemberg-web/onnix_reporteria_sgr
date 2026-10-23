import "server-only";
import ExcelJS from "exceljs";
import type { PaginaExcel, Region, TipoColumna } from "./tipos";

const FORMATO: Record<TipoColumna, string | undefined> = {
  texto: undefined,
  entero: "#,##0",
  decimal: "#,##0.00",
  horas: "#,##0.0",
  dias: "#,##0.0",
  gs: "#,##0",
  pct: "0.0%",
  indice: "0.00",
  fecha: "dd/mm/yyyy",
};

const AZUL = "FF2F4BB0";

function valor(v: unknown, tipo: TipoColumna) {
  if (v === null || v === undefined || v === "") return null;
  if (tipo === "fecha") {
    const s = String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  }
  if (tipo === "texto") return typeof v === "boolean" ? (v ? "Sí" : "No") : String(v);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nombre de hoja válido para Excel (31 caracteres, sin : \\ / ? * [ ]) y único. */
function nombreHoja(titulo: string, usados: Set<string>) {
  const base = titulo.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim() || "Hoja";
  let nombre = base, k = 2;
  while (usados.has(nombre.toLowerCase())) nombre = `${base.slice(0, 27)} (${k++})`;
  usados.add(nombre.toLowerCase());
  return nombre;
}

function agregarRegion(libro: ExcelJS.Workbook, r: Region, usados: Set<string>) {
  const hoja = libro.addWorksheet(nombreHoja(r.hoja ?? r.titulo, usados), { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = r.columnas.map((c) => ({ header: c.titulo, key: c.clave, style: { numFmt: FORMATO[c.tipo] } }));
  for (const f of r.filas) {
    const fila: Record<string, unknown> = {};
    for (const c of r.columnas) fila[c.clave] = valor(f[c.clave], c.tipo);
    hoja.addRow(fila);
  }
  const cab = hoja.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  cab.alignment = { vertical: "middle", wrapText: true };
  cab.height = 30;
  if (r.columnas.length && r.filas.length) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + r.filas.length, column: r.columnas.length } };
  }
  // Ancho según el contenido, con tope.
  r.columnas.forEach((c, i) => {
    let ancho = Math.min(Math.max(c.titulo.length * 0.9, 8), 28);
    for (const f of r.filas) {
      const v = f[c.clave];
      const largo = v == null ? 0 : c.tipo === "fecha" ? 10 : String(typeof v === "number" ? Math.round(v * 10) / 10 : v).length + (c.tipo === "gs" ? 4 : 1);
      if (largo > ancho) ancho = largo;
    }
    hoja.getColumn(i + 1).width = Math.min(ancho + 2, 60);
  });
  if (r.nota) {
    const n = hoja.addRow([]);
    void n;
    const nota = hoja.addRow([r.nota]);
    nota.font = { italic: true, color: { argb: "FF5A6475" } };
  }
}

export async function generarLibro(p: PaginaExcel, regiones: Region[], usuario: string) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Productividad del servicio";
  libro.created = new Date();
  const usados = new Set<string>();

  const meta = libro.addWorksheet(nombreHoja("Filtros", usados));
  meta.columns = [{ width: 26 }, { width: 110 }];
  meta.addRow(["Productividad del servicio de desarrollo y testing"]).font = { bold: true, size: 14 };
  meta.addRow([]);
  const filas: [string, string][] = [
    ["Reporte", p.titulo],
    ...p.meta,
    ["Hojas", regiones.map((r) => (r.hoja && r.hoja !== r.titulo ? `${r.hoja} (${r.titulo})` : r.titulo)).join("; ")],
    ["Generado por", usuario],
    ["Generado el", new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short", timeZone: process.env.APP_TZ || "America/Asuncion" }).format(new Date())],
  ];
  for (const [k, v] of filas) {
    const row = meta.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  for (const r of regiones) agregarRegion(libro, r, usados);
  return Buffer.from(await libro.xlsx.writeBuffer());
}
