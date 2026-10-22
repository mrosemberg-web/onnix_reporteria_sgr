import { dias, horas, num, pct } from "./formato";
import { mediana, resumir, type Analisis } from "./seguimiento-calculo";

const enCurso = (a: Analisis) => a.etapa !== "sin_asignacion";

export function lecturaSeguimiento(items: Analisis[]): string[] {
  const out: string[] = [];
  const sgr = items.filter(enCurso);
  if (!sgr.length) return ["No hay SGR en curso para los filtros elegidos."];
  const r = resumir(items);
  if (r.pausasSinRegistrar) {
    out.push(`Revisar datos: ${num(r.pausasSinRegistrar)} SGR detenidos tienen menos horas pausadas que los días hábiles que llevan en ese estado. Ese tiempo sin registrar se cuenta como ejecución, así que el atraso por ejecución puede estar sobrestimado.`);
  }
  const desa = sgr.filter((a) => a.fase === "desa").length;
  const test = sgr.length - desa;
  const conFecha = sgr.filter((a) => ["atrasado", "vence_pronto", "en_plazo"].includes(a.situacion)).length;

  const donde = desa && test ? `: ${num(desa)} en desarrollo y ${num(test)} en testing` : desa ? " en desarrollo" : " en testing";
  out.push(`Hay ${num(sgr.length)} SGR en curso${donde}. ${num(r.atrasados)} ${r.atrasados === 1 ? "está atrasado" : "están atrasados"} respecto de la entrega estimada original${conFecha ? ` (${pct(r.atrasados / conFecha)} de los que tienen fecha vigente y no terminaron su fase)` : ""}.`);

  if (r.diasAtraso > 0) {
    const ext = r.causas.pausas + r.causas.cliente;
    out.push(`De los ${num(r.diasAtraso)} días hábiles de atraso acumulados, ${pct(ext / r.diasAtraso)} se explican por espera del cliente y pausas anteriores, ${pct(r.causas.devoluciones / r.diasAtraso)} por devoluciones de testing, ${pct(r.causas.pausa / r.diasAtraso)} por pausas sin motivo registrado y ${pct(r.causas.ejecucion / r.diasAtraso)} por ejecución.`);
  }

  const ejec = sgr.filter((a) => a.etapa !== "finalizado" && a.causas.ejecucion > 0);
  if (ejec.length) {
    const grupo = (t: string) => ejec.filter((a) => a.ejecucion === t);
    const d = (l: Analisis[]) => l.reduce((s, a) => s + a.causas.ejecucion, 0);
    const [h, rt, si] = [grupo("horas"), grupo("ritmo"), grupo("sin_iniciar")];
    const partes = [
      h.length ? `${num(h.length)} ${h.length === 1 ? "SGR superó" : "SGR superaron"} las horas presupuestadas (${num(d(h))} días)` : "",
      rt.length ? `${num(rt.length)} ${rt.length === 1 ? "usó" : "usaron"} menos horas de las presupuestadas pero se ${rt.length === 1 ? "le venció" : "les venció"} la fecha (${num(d(rt))} días), lo que indica poca dedicación diaria o trabajo en paralelo` : "",
      si.length ? `${num(si.length)} ${si.length === 1 ? "venció" : "vencieron"} sin empezar a trabajarse (${num(d(si))} días)` : "",
    ].filter(Boolean);
    out.push(`En el atraso por ejecución, ${partes.join("; ")}.`);
  }

  const cliente = sgr.filter((a) => a.etapa === "cliente" && a.diasEnEstado != null);
  if (cliente.length) {
    const mas = [...cliente].sort((a, b) => (b.diasEnEstado ?? 0) - (a.diasEnEstado ?? 0))[0];
    out.push(`${num(cliente.length)} SGR esperan respuesta o pruebas del cliente; la mitad lleva más de ${dias(mediana(cliente.map((a) => a.diasEnEstado!)))} hábiles en ese estado. El más antiguo es el SGR ${mas.id_req}, con ${dias(mas.diasEnEstado)} hábiles.`);
  }

  const tst = sgr.filter((a) => a.fase === "test");
  if (tst.some((a) => (a.devoluciones ?? 0) > 0)) {
    const con = tst.filter((a) => (a.devoluciones ?? 0) >= 2 && a.atraso != null).map((a) => a.atraso!);
    const sin = tst.filter((a) => (a.devoluciones ?? 0) === 0 && a.atraso != null).map((a) => a.atraso!);
    let texto = `En testing, ${num(r.sgrConDevolucion)} SGR fueron devueltos al desarrollador (${num(r.devoluciones)} devoluciones en total)`;
    if (con.length && sin.length) texto += `; con 2 o más devoluciones el atraso mediano es de ${dias(mediana(con))}, contra ${dias(mediana(sin))} sin devoluciones`;
    out.push(texto + ".");
  }

  const pausa = sgr.filter((a) => a.etapa === "pausa");
  if (pausa.length) {
    out.push(`${num(pausa.length)} SGR están en pausa sin indicar el motivo (en promedio ${dias(pausa.reduce((s, a) => s + (a.diasEnEstado ?? 0), 0) / pausa.length)}). Registrar si esperan al cliente permitiría separar ese tiempo de la ejecución.`);
  }

  if (r.excedidos) out.push(`${num(r.excedidos)} SGR ya superaron sus horas presupuestadas, por ${horas(r.horasExcedidas)} en total.`);
  if (r.enAnalisis) out.push(`${num(r.enAnalisis)} SGR están en análisis o presupuesto, revisando el alcance; sus fechas no se cuentan como vencidas.`);
  if (r.sinPlan) out.push(`${num(r.sinPlan)} SGR todavía no tienen fecha de entrega comprometida.`);
  const sinAsignar = items.filter((a) => a.etapa === "sin_asignacion");
  if (sinAsignar.length) out.push(`Sin SGR asignado: ${sinAsignar.map((a) => a.nombre ?? a.usuario).join(", ")}.`);
  return out;
}
