// Texto de búsqueda de una fila: en minúsculas, sin tildes, con todas las partes juntas.
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function textoBusqueda(...partes: (string | number | null | undefined)[]) {
  return normalizar(partes.filter((p) => p != null && p !== "").join(" "));
}
