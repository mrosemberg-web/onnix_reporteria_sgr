// Feriados nacionales de Paraguay según la Ley 7544/2025 (sin dependencias de servidor).

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function pascua(anio: number) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const diaSemana = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();

export type FeriadoLegal = { fecha: string; descripcion: string; movil: boolean };

/** Feriados del año en su fecha legal. Los móviles pueden trasladarse por decreto. */
export function feriadosDelAnio(anio: number): FeriadoLegal[] {
  const p = iso(pascua(anio));
  const f = (md: string, descripcion: string, movil = false) => ({ fecha: `${anio}-${md}`, descripcion, movil });
  const lista: FeriadoLegal[] = [
    f("01-01", "Año Nuevo"),
    f("03-01", "Día de los Héroes", true),
    { fecha: sumarDias(p, -3), descripcion: "Jueves Santo", movil: false },
    { fecha: sumarDias(p, -2), descripcion: "Viernes Santo", movil: false },
    f("05-01", "Día de los Trabajadores"),
    f("05-14", "Independencia Nacional"),
    f("05-15", "Independencia Nacional y Día de la Madre"),
    f("06-12", "Paz del Chaco", true),
    ...(anio >= 2026 ? [f("06-20", "Jura de la Constitución Nacional", true)] : []),
    f("08-15", "Fundación de Asunción"),
    f("09-29", "Batalla de Boquerón", true),
    f("12-08", "Virgen de Caacupé"),
    f("12-25", "Navidad"),
  ];
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Lunes anterior y siguiente a una fecha (la ley permite trasladar a cualquiera de los dos). */
export function lunesCercanos(fecha: string) {
  const d = diaSemana(fecha);
  if (d === 1) return null;
  const atras = (d + 6) % 7, adelante = (8 - d) % 7 || 7;
  return { anterior: sumarDias(fecha, -atras), siguiente: sumarDias(fecha, adelante) };
}

/** Quita la referencia al decreto del motivo: "Paz del Chaco (Decreto 3047)" -> "Paz del Chaco". */
export const motivoBase = (s: string) => s.replace(/\s*\(Decreto[^)]*\)\s*$/i, "").trim();
