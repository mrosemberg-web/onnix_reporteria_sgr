// Genera la "lectura" en texto de cada reporte a partir de los agregados.
import { dias, gsCorto, horas, num, pct } from "./formato";
import { indice, pctPausa, type AggFase, type Fase, type FilaResponsable, type KpisReq } from "./reportes";

const NOMBRE = { desa: "desarrollo", test: "testing" } as const;

export function lecturaFase(fz: Fase, t: AggFase, resp: FilaResponsable[]): string[] {
  const out: string[] = [];
  if (t.sgr === 0) return ["No hay SGR con esta fase para los filtros elegidos."];
  const conHoras = t.sgr - t.sin_registro;
  const idx = indice(t);

  if (idx !== null) {
    const desest = t.desestimados ? ` (${num(t.desestimados)} de ellos desestimados por el cliente, que cuentan como entregados)` : "";
    const cliente = fz === "test" && t.solo_test ? `, ${num(t.solo_test)} de ellos sobre desarrollos internos del cliente` : "";
    const base = `Se cerraron ${num(t.sgr)} SGR de ${NOMBRE[fz]}${cliente}${desest}. En los ${num(conHoras)} con horas cargadas se trabajaron ${horas(t.real_reg)} contra ${horas(t.presu_reg)} presupuestadas (índice de cumplimiento ${num(idx, 2)}).`;
    if (idx >= 1) {
      out.push(`${base} El equipo usó ${pct(1 - t.real_reg / t.presu_reg)} menos horas de las presupuestadas.`);
    } else {
      out.push(`${base} El excedente neto fue de ${horas(t.real_reg - t.presu_reg)}; como la facturación se calcula sobre horas presupuestadas, ese excedente no se trasladó al cliente.`);
    }
  }

  if (conHoras > 0) {
    out.push(
      `${num(t.dentro)} SGR (${pct(t.dentro / conHoras)}) terminaron dentro del presupuesto y ${num(t.leve)} con un desvío de hasta 10 %; ${num(t.sobre)} lo superaron por más de 10 %.`
    );
  }

  const pp = pctPausa(t);
  if (pp !== null && pp > 0.005) {
    out.push(
      `El ${pct(pp)} del tiempo hábil de ${NOMBRE[fz]} estuvo en pausa (${horas(t.horas_pausadas)} acumuladas), tiempo detenido que incluye la espera de respuestas del cliente. Descontando pausas, la mediana de duración baja de ${dias(t.dias_hab_med)} a ${dias(t.dias_netos_med)} hábiles.`
    );
  }

  if (t.sgr_con_devolucion > 0) {
    out.push(
      `${num(t.sgr_con_devolucion)} SGR (${pct(t.sgr_con_devolucion / t.sgr)}) debieron devolverse al cliente por falta de datos o consultas, con ${num(t.devoluciones)} devoluciones en total. Ese tiempo de espera no depende del equipo.`
    );
  }

  // Lectura por persona: solo quienes tienen volumen suficiente para comparar.
  const conVolumen = resp.filter((r) => r.responsable !== "Sin asignar" && r.real_reg > 0 && r.sgr - r.sin_registro >= 3);
  if (conVolumen.length >= 2) {
    const mayor = [...conVolumen].sort((a, b) => b.entregados - a.entregados || b.horas_real - a.horas_real)[0];
    out.push(`${mayor.responsable} concentra el mayor volumen: ${num(mayor.entregados)} SGR entregados y ${horas(mayor.horas_real)} trabajadas.`);
    const enPresu = conVolumen.filter((r) => (indice(r) ?? 0) >= 1 / 1.1).map((r) => r.responsable);
    const revisar = conVolumen.filter((r) => (indice(r) ?? 1) < 0.75).map((r) => r.responsable);
    if (enPresu.length) out.push(`Dentro del presupuesto o con desvío de hasta 10 % en el total de sus SGR: ${enPresu.join(", ")}.`);
    if (revisar.length) out.push(`Con índice menor a 0,75, conviene revisar la estimación de sus SGR: ${revisar.join(", ")}.`);
  }

  if (t.sin_registro > 0) {
    out.push(`${num(t.sin_registro)} SGR tienen horas presupuestadas pero ninguna hora cargada; se muestran aparte y no entran en el índice.`);
  }
  return out;
}

/** Lectura del resumen: desarrollos, testing como servicio adicional, presupuesto y devoluciones al cliente. */
export function lecturaResumen(k: KpisReq, desa: AggFase, test: AggFase): string[] {
  const out: string[] = [];
  out.push(
    `Se entregaron ${num(k.desarrollos_entregados)} desarrollos. Además, Testing se prestó como servicio adicional en ${num(k.testing_entregados)} SGR entregados: ${num(k.testing_onnix)} sobre desarrollos de Onnix y ${num(k.testing_cliente)} sobre desarrollos internos del cliente${k.facturado_test_cliente ? ` (${gsCorto(k.facturado_test_cliente)} facturables)` : ""}.`
  );
  if (k.sgr_pap) out.push(`${num(k.sgr_pap)} SGR están en pase a producción, todavía sin pasar al estado final.`);
  if (k.desestimados) {
    out.push(`${num(k.desestimados)} de los entregados fueron desestimados por el cliente: consumieron ${horas(k.horas_desestimados)} de trabajo y suman ${gsCorto(k.facturado_desestimados)} facturables${k.descuento_desestimados ? `, con ${gsCorto(k.descuento_desestimados)} de descuento respecto de presupuesto por tarifa` : ""}. Cuentan como entregados aunque no pasaron a producción.`);
  }
  out.push(...lecturaFase("desa", desa, []).slice(0, 1), ...lecturaFase("test", test, []).slice(0, 1));
  if (k.sgr_con_devolucion) {
    out.push(`${num(k.sgr_con_devolucion)} SGR (${pct(k.sgr_con_devolucion / k.sgr)}) se devolvieron al cliente por falta de datos o consultas. El tiempo de entrega se informa descontando las pausas, para separar la espera del cliente del trabajo del equipo.`);
  }
  if (k.desa_sin_presu) {
    out.push(`${num(k.desa_sin_presu)} SGR tienen ${horas(k.horas_desa_sin_presu)} de desarrollo cargadas sin presupuesto de desarrollo; no se cuentan como desarrollos ni suman horas.`);
  }
  return out;
}
