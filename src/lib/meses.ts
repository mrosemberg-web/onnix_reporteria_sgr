// Series mensuales para uno o varios años.
import { MESES } from "./formato";

export type Mes = { clave: string; etiqueta: string; anio: number; mes: number; previo?: boolean };

function mesActual() {
  const tz = process.env.APP_TZ || "America/Asuncion";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric" }).formatToParts(new Date());
  return { anio: Number(p.find((x) => x.type === "year")?.value), mes: Number(p.find((x) => x.type === "month")?.value) };
}

const clave = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;

/**
 * Meses a mostrar: cada año elegido completo (el año en curso, hasta el mes actual),
 * más cualquier mes con datos que quede fuera. Los meses con datos anteriores al
 * primer año se agrupan en "Previo" si incluirPrevio es true.
 */
export function construirMeses(anios: number[], clavesConDatos: string[], incluirPrevio = false) {
  const hoy = mesActual();
  const varios = anios.length > 1;
  const etiqueta = (a: number, m: number) => (varios ? `${MESES[m - 1]} ${String(a).slice(2)}` : MESES[m - 1]);
  const mapa = new Map<string, Mes>();
  for (const a of anios) {
    const hasta = a < hoy.anio ? 12 : a === hoy.anio ? hoy.mes : 1;
    for (let m = 1; m <= hasta; m++) mapa.set(clave(a, m), { clave: clave(a, m), etiqueta: etiqueta(a, m), anio: a, mes: m });
  }
  const inicio = clave(anios[0], 1);
  let hayPrevio = false;
  for (const k of clavesConDatos) {
    if (k < inicio) { hayPrevio = true; continue; }
    if (!mapa.has(k)) {
      const [a, m] = k.split("-").map(Number);
      mapa.set(k, { clave: k, etiqueta: etiqueta(a, m), anio: a, mes: m });
    }
  }
  const meses = [...mapa.values()].sort((x, y) => x.clave.localeCompare(y.clave));
  if (incluirPrevio && hayPrevio) meses.unshift({ clave: "previo", etiqueta: "Previo", anio: anios[0] - 1, mes: 0, previo: true });
  const ultimo = meses.at(-1);
  return { meses, inicio, enCurso: !!ultimo && ultimo.anio === hoy.anio && ultimo.mes === hoy.mes };
}

/** Clave del mes en que cae una fila, respetando el balde "Previo". */
export function claveDestino(k: string, inicio: string, incluirPrevio: boolean) {
  return incluirPrevio && k < inicio ? "previo" : k;
}
