// Secciones del sistema a las que se puede limitar el acceso de un usuario.
export type Seccion = "implementados" | "en_curso";

export const SECCIONES: { clave: Seccion; nombre: string; inicio: string }[] = [
  { clave: "implementados", nombre: "Implementados", inicio: "/" },
  { clave: "en_curso", nombre: "En curso", inicio: "/en-curso" },
];
export const TODAS: Seccion[] = SECCIONES.map((s) => s.clave);

export const nombreSeccion = (s: string) => SECCIONES.find((x) => x.clave === s)?.nombre ?? s;

/** Normaliza lo que viene de la base o de un formulario: solo valores válidos, sin repetir. */
export function seccionesValidas(v: unknown): Seccion[] {
  const arr = Array.isArray(v) ? v : [];
  return TODAS.filter((s) => arr.includes(s));
}

/** Página de inicio según las secciones habilitadas. */
export function inicioDe(secciones: Seccion[]) {
  return SECCIONES.find((s) => secciones.includes(s.clave))?.inicio ?? "/cuenta";
}

/**
 * Sección a la que pertenece una ruta. La Proyección de entregas está en el menú
 * de Implementados, así que depende de ese permiso aunque su ruta sea /en-curso/proyeccion.
 */
export function seccionDeRuta(ruta: string): Seccion {
  if (ruta === "/en-curso/proyeccion") return "implementados";
  return ruta === "/en-curso" || ruta.startsWith("/en-curso/") ? "en_curso" : "implementados";
}
