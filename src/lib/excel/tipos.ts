// Definición de una región exportable: columnas tipadas y filas.
export type TipoColumna = "texto" | "entero" | "decimal" | "horas" | "dias" | "gs" | "pct" | "indice" | "fecha";

export type Columna = { clave: string; titulo: string; tipo: TipoColumna };

export type Region = {
  id: string;
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
  /** Nombre corto de la hoja (máximo 31 caracteres); si falta, se usa el título. */
  hoja?: string;
  /** Aclaración que se escribe debajo de la tabla. */
  nota?: string;
};

export type DefRegion = { id: string; titulo: string; construir: () => Promise<Region[]> };

export type PaginaExcel = {
  titulo: string;
  /** Pares etiqueta/valor para la hoja de filtros. */
  meta: [string, string][];
  regiones: DefRegion[];
};

/** Atajo para declarar columnas: ["clave", "Título", "tipo"]. */
export const cols = (...c: [string, string, TipoColumna][]): Columna[] => c.map(([clave, titulo, tipo]) => ({ clave, titulo, tipo }));
