const nf = (dec: number) => new Intl.NumberFormat("es-PY", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function num(n: number | null | undefined, dec = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return nf(dec).format(n);
}

export function horas(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  return `${num(n, Math.abs(n) < 100 && n % 1 !== 0 ? 1 : 0)} h`;
}

export function dias(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  return `${num(n, n < 10 && n % 1 !== 0 ? 1 : 0)} d`;
}

export function gs(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  return `Gs. ${num(n)}`;
}

/** Guaraníes abreviados en millones (M) para KPIs. */
export function gsCorto(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  if (Math.abs(n) >= 1e9) return `Gs. ${num(n / 1e9, 2)} mil M`;
  if (Math.abs(n) >= 1e6) return `Gs. ${num(n / 1e6, 1)} M`;
  return gs(n);
}

export function pct(x: number | null | undefined, dec = 0) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${num(x * 100, dec)} %`;
}

export function fecha(iso: string | null | undefined) {
  if (!iso) return "–";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fechaHora(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short", timeStyle: "short", timeZone: process.env.APP_TZ || "America/Asuncion",
  }).format(new Date(d));
}

export function nombreMes(m: number) {
  return m === 0 ? "Previo" : MESES[m - 1] ?? String(m);
}

export const NOMBRE_FASE = { desa: "Desarrollo", test: "Testing" } as const;
