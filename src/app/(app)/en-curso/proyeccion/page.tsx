import { TituloRegion } from "@/components/BotonExcel";
import { FechaCorteMes } from "@/components/FechaCorteMes";
import { BarrasAcumulado } from "@/components/graficos";
import { EncabezadoSeguimiento, SinSeguimiento } from "@/components/seguimiento-ui";
import { Indicador, Lectura } from "@/components/ui";
import { requerirSesion } from "@/lib/auth";
import type { SearchParams } from "@/lib/filtros";
import { fecha, gs, gsCorto, MESES, MESES_LARGOS, num, pct } from "@/lib/formato";
import { ESCENARIOS, proyeccion, TARIFA_TEST_HORA, type ItemProyeccion } from "@/lib/proyeccion";
import { leerFiltrosSeguimiento, opcionesSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyección de entregas" };

const M = (v: number) => num(v / 1e6, 1);
const nombreCol = (c: string, actual: string) =>
  c === "siguiente" ? "Año siguiente" : `${MESES[+c.slice(5, 7) - 1]} ${c.slice(0, 4)}${c === actual ? " (en curso)" : ""}`;
const ORDEN = { entregado: 0, proyectado: 1, vencido: 2, sin_fecha: 3 };

export default async function Proyeccion({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sesion = await requerirSesion();
  const sp = await searchParams;
  const f = { ...leerFiltrosSeguimiento(sp), fases: [], etapas: [], situaciones: [] };
  const p = await proyeccion(f, { hasta: Array.isArray(sp.hasta) ? sp.hasta[0] : sp.hasta });
  if (!p.analisis.length) return <SinSeguimiento esAdmin={sesion.rol === "admin"} />;
  const op = opcionesSeguimiento(p.analisis);
  const equipo = (fz: "desa" | "test") => p.analisis.find((a) => a.fase === fz && a.equipo)?.equipo ?? (fz === "desa" ? "Desarrollo" : "Testing");
  const actual = p.meses[0];
  const mesActual = p.matriz[0];
  const tot = (c: (typeof p.matriz)[number]) => c.desa.entregado + c.desa.proyectado + c.test.entregado + c.test.proyectado;
  const totalAnio = p.matriz.filter((c) => c.clave !== "siguiente").reduce((s, c) => s + tot(c), 0);
  const siguiente = p.matriz.find((c) => c.clave === "siguiente")!;
  const proyectadoTotal = p.matriz.reduce((s, c) => s + c.desa.proyectado + c.test.proyectado, 0);
  const estimadoTotal = p.matriz.reduce((s, c) => s + c.estimado, 0);
  const venc = p.vencidos.desa + p.vencidos.test, sinF = p.sinFecha.desa + p.sinFecha.test;
  const nombreMesLargo = (c: string) => MESES_LARGOS[+c.slice(5, 7) - 1];

  let acc = 0;
  const datosGrafico = p.matriz.map((c) => {
    acc = c.clave === "siguiente" ? Math.round(tot(c) / 1e6) : acc + Math.round(tot(c) / 1e6);
    return {
      etiqueta: c.clave === "siguiente" ? "Año sig." : MESES[+c.clave.slice(5, 7) - 1],
      segmentos: [c.desa.entregado, c.desa.proyectado, c.test.entregado, c.test.proyectado].map((v) => Math.round(v / 1e6)),
      acumulado: acc, grupo: c.clave === "siguiente" ? 1 : 0,
    };
  });

  const nombreMes = (m: string) => (+m.slice(0, 4) > p.anioCorte ? "el año siguiente" : MESES_LARGOS[+m.slice(5, 7) - 1]);
  const lectura = [
    !p.hastaPorDefecto ? (p.corridos.sgr
      ? `Con la fecha de corte al ${fecha(p.hasta)}, ${num(p.corridos.sgr)} SGR (${gsCorto(p.corridos.monto)}) ${p.corridos.sgr === 1 ? "estimado para después de esa fecha pasa" : "estimados para después de esa fecha pasan"} de ${nombreMes(p.corridos.de)} a ${nombreMes(p.corridos.a)}.`
      : `Con la fecha de corte al ${fecha(p.hasta)} ningún SGR cambia de mes.`) : "",
    `En ${nombreMesLargo(actual)} se proyectan ${gsCorto(tot(mesActual))}: ${gsCorto(mesActual.desa.entregado + mesActual.test.entregado)} ya entregados (${num(mesActual.entregados)} SGR) y ${gsCorto(mesActual.desa.proyectado + mesActual.test.proyectado)} por entregar (${num(mesActual.proyectados)} SGR).`,
    `Hasta diciembre suman ${gsCorto(totalAnio)}; el año siguiente acumula ${gsCorto(tot(siguiente))} en ${num(siguiente.proyectados)} SGR.`,
    venc ? `${num(p.vencidos.sgr)} SGR con la fecha vencida y sin entregar suman ${gsCorto(venc)}. No entran en ningún mes; si se entregaran este mes, el total de ${nombreMesLargo(actual)} llegaría a ${gsCorto(tot(mesActual) + venc)}.` : "",
    sinF ? `${num(p.sinFecha.sgr)} SGR sin fecha vigente (sin estimación o en análisis de alcance) suman ${gsCorto(sinF)}.` : "",
    estimadoTotal ? `${pct(proyectadoTotal ? estimadoTotal / proyectadoTotal : 0)} del monto por entregar depende de fechas de fin de testing estimadas, porque esos SGR todavía están en desarrollo.` : "",
  ].filter(Boolean);

  const ordenados = [...p.items].sort((a, b) => ORDEN[a.destino] - ORDEN[b.destino] || String(a.mes ?? a.fecha ?? "").localeCompare(String(b.mes ?? b.fecha ?? "")) || (b.desa + b.test) - (a.desa + a.test));

  const fila = (titulo: string, valores: number[], extra: number[], clase?: string) => (
    <tr className={clase}>
      <td>{titulo}</td>
      {valores.map((v, i) => <td key={i} className="n">{v ? M(v) : "–"}</td>)}
      <td className="n"><strong>{M(valores.reduce((s, v) => s + v, 0))}</strong></td>
      {extra.map((v, i) => <td key={`e${i}`} className="n debil">{v ? M(v) : "–"}</td>)}
    </tr>
  );
  const serie = (k: "desa" | "test", t: "entregado" | "proyectado") => p.matriz.map((c) => c[k][t]);
  const suma = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

  return (
    <>
      <EncabezadoSeguimiento titulo="Proyección de entregas" op={op} f={f} cargas={p.cargas} mostrarFase={false} soloPersonas
        bajada={<>Montos presupuestados por mes y por equipo según la fecha estimada de entrega, corregida por pausas y en días hábiles. Si hay desarrollo y testing, manda el fin de testing; si solo hay desarrollo, el fin de desarrollo; si es solo testing de un desarrollo del cliente, el fin de testing.</>} />

      <FechaCorteMes key={p.hasta} valor={p.hasta} min={p.limites.min} max={p.limites.max} porDefecto={p.hastaPorDefecto} />
      {!p.hastaPorDefecto && (
        <p className="solo-impresion impresion-meta">Fecha de corte del mes: {fecha(p.hasta)}. Lo estimado para después de esa fecha, dentro del mismo mes, pasa al mes siguiente.</p>
      )}

      <section className="banda">
        <Indicador nombre={`${MESES[+actual.slice(5, 7) - 1]} (mes en curso)`} valor={gsCorto(tot(mesActual))} nota={`${gsCorto(mesActual.desa.entregado + mesActual.test.entregado)} ya entregados`} />
        <Indicador nombre="Por entregar hasta diciembre" valor={gsCorto(totalAnio - mesActual.desa.entregado - mesActual.test.entregado)} nota={`incluye ${MESES[+actual.slice(5, 7) - 1]}`} />
        <Indicador nombre="Año siguiente" valor={gsCorto(tot(siguiente))} nota={`${num(siguiente.proyectados)} SGR`} />
        <Indicador nombre="Vencidos sin entregar" valor={gsCorto(venc)} nota={`${num(p.vencidos.sgr)} SGR, fuera de los meses`} />
        <Indicador nombre="Sin fecha vigente" valor={gsCorto(sinF)} nota={`${num(p.sinFecha.sgr)} SGR`} />
        <Indicador nombre="Con fecha estimada" valor={pct(proyectadoTotal ? estimadoTotal / proyectadoTotal : 0)} nota="del monto por entregar" />
      </section>

      <Lectura parrafos={lectura} />

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="proyeccion">Proyección por mes y equipo</TituloRegion>
          <p>Millones de guaraníes. «Ya entregado» solo aplica al mes en curso.</p>
        </div>
        <div className="tabla-env">
          <table className="tabla-proyeccion">
            <thead>
              <tr>
                <th />
                {p.columnas.map((c) => <th key={c} className="n">{nombreCol(c, actual)}</th>)}
                <th className="n">Total</th>
                <th className="n" title="Fecha pasada y todavía en curso">Vencidos sin entregar</th>
                <th className="n" title="Sin fecha estimada o en análisis de alcance">Sin fecha vigente</th>
              </tr>
            </thead>
            <tbody>
              <tr className="grupo"><td colSpan={p.columnas.length + 4}>Desarrollo: {equipo("desa")}</td></tr>
              {fila("Ya entregado", serie("desa", "entregado"), [0, 0])}
              {fila("Por entregar", serie("desa", "proyectado"), [p.vencidos.desa, p.sinFecha.desa])}
              {fila("Total desarrollo", suma(serie("desa", "entregado"), serie("desa", "proyectado")), [p.vencidos.desa, p.sinFecha.desa], "subtotal")}
              <tr className="grupo"><td colSpan={p.columnas.length + 4}>Testing: {equipo("test")}</td></tr>
              {fila("Ya entregado", serie("test", "entregado"), [0, 0])}
              {fila("Por entregar", serie("test", "proyectado"), [p.vencidos.test, p.sinFecha.test])}
              {fila("Total testing", suma(serie("test", "entregado"), serie("test", "proyectado")), [p.vencidos.test, p.sinFecha.test], "subtotal")}
            </tbody>
            <tfoot>
              {fila("Total de los dos equipos", p.matriz.map(tot), [venc, sinF])}
              <tr>
                <td>SGR</td>
                {p.matriz.map((c) => <td key={c.clave} className="n">{num(c.entregados + c.proyectados)}</td>)}
                <td className="n">{num(p.matriz.reduce((s, c) => s + c.entregados + c.proyectados, 0))}</td>
                <td className="n debil">{num(p.vencidos.sgr)}</td><td className="n debil">{num(p.sinFecha.sgr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="debil" style={{ marginTop: 10, fontSize: "0.82rem" }}>
          Cada SGR entra completo en un solo mes y su importe de desarrollo va al equipo de desarrollo y el de testing al de testing.
          Para los SGR que siguen en desarrollo y necesitan testing, el fin de testing se estima sumando a su entrega de desarrollo los días
          hábiles de testing que surgen del importe (÷ Gs. {num(TARIFA_TEST_HORA)} por hora ÷ 8 horas). Ya entregado en el mes en curso: implementados
          (incluidos los desestimados por el cliente, con el importe de la planilla, que ya refleja el descuento acordado) y SGR en
          «Testing Finalizado» o «Desarrollo Finalizado» cuya fecha que manda cayó en el mes, hasta la fecha de corte ({fecha(p.corte)}).
        </p>
      </section>

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="proyeccion">Monto por mes</TituloRegion>
          <p>Millones de guaraníes. La línea acumula hasta diciembre; el año siguiente va aparte.</p>
        </div>
        <BarrasAcumulado unidad="M" nombreLinea="Acumulado del año (eje derecho)" datos={datosGrafico}
          series={[
            { nombre: "Desarrollo, ya entregado", color: "var(--desa)" },
            { nombre: "Desarrollo, por entregar", color: "color-mix(in srgb, var(--desa) 45%, var(--superficie))", colorTexto: "var(--tinta)" },
            { nombre: "Testing, ya entregado", color: "var(--test)" },
            { nombre: "Testing, por entregar", color: "color-mix(in srgb, var(--test) 45%, var(--superficie))", colorTexto: "var(--tinta)" },
          ]} />
      </section>

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="detalle">Detalle por SGR</TituloRegion>
          <p>De dónde sale cada monto: el mes asignado, la fecha que manda y si fue estimada.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr><th>Mes</th><th>SGR</th><th>Asunto</th><th>Escenario</th><th>Situación</th><th>Responsable</th>
                <th>Fecha que manda</th><th className="n">Desarrollo (Gs.)</th><th className="n">Testing (Gs.)</th><th className="n">Total (Gs.)</th></tr>
            </thead>
            <tbody>
              {ordenados.map((i) => (
                <tr key={`${i.origen}-${i.id_req}`}>
                  <td className="nombre"><DestinoChip i={i} actual={actual} /></td>
                  <td className="nombre">{i.id_req}{i.desestimado && <span className="etiqueta e-neutro" style={{ marginLeft: 6 }}>Desestimado</span>}</td>
                  <td className="recorte" title={i.asunto ?? ""}>{i.asunto}</td>
                  <td>{ESCENARIOS[i.escenario]}</td>
                  <td className="recorte" style={{ maxWidth: 220 }} title={i.situacion}>{i.situacion}</td>
                  <td>{i.responsable}</td>
                  <td className="nombre">
                    {i.fecha ? fecha(i.fecha) : "–"}
                    <span className="debil"> {i.base === "fin_testing" ? "fin de testing" : "fin de desarrollo"}</span>
                    {i.estimada && <span className="etiqueta e-leve" style={{ marginLeft: 6 }}>Estimada</span>}
                    {i.corrido && <span className="etiqueta e-neutro" style={{ marginLeft: 6 }} title={`Posterior a la fecha de corte del mes (${fecha(p.hasta)})`}>Pasa al mes siguiente</span>}
                  </td>
                  <td className="n">{i.desa ? gs(i.desa) : "–"}</td>
                  <td className="n">{i.test ? gs(i.test) : "–"}</td>
                  <td className="n">{gs(i.desa + i.test)}{i.descuento ? <span className="debil" title="Presupuesto por tarifa menos importe de la planilla"> (desc. {gs(i.descuento)})</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DestinoChip({ i, actual }: { i: ItemProyeccion; actual: string }) {
  if (i.destino === "entregado") return <span className="etiqueta e-bien">{nombreCol(actual, "")}: entregado</span>;
  if (i.destino === "vencido") return <span className="etiqueta e-mal">Vencido</span>;
  if (i.destino === "sin_fecha") return <span className="etiqueta e-neutro">Sin fecha vigente</span>;
  return <span className="etiqueta e-desa">{nombreCol(i.mes!, "")}</span>;
}
