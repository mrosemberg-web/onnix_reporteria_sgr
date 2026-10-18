import { BarrasH } from "@/components/graficos";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import { textoAnios, type SearchParams } from "@/lib/filtros";
import { claseServicio, nombreServicio } from "@/lib/servicios";
import { dias, horas, num, pct } from "@/lib/formato";
import { indice, pctPausa, tiempos } from "@/lib/reportes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tiempos y devoluciones" };

const TRAMOS = ["Hasta 7 días", "8 a 15 días", "16 a 30 días", "31 a 60 días", "61 a 90 días", "Más de 90 días"];
const GRUPOS = ["Sin devoluciones al cliente", "1 devolución", "2 devoluciones", "3 o más"];

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const { desa, test, tramos, porDevolucion, masPausados, calidad, porServicio } = await tiempos(f);

  const sinDev = porDevolucion.find((g) => g.grupo === 0);
  const conDev = porDevolucion.filter((g) => g.grupo > 0);
  const totalTramos = tramos.reduce((s, t) => s + t.sgr, 0);
  const rapidos = tramos.filter((t) => t.tramo <= 3).reduce((s, t) => s + t.sgr, 0);

  const lectura: string[] = [];
  if (totalTramos) lectura.push(`${pct(rapidos / totalTramos)} de los SGR entregados llegaron a producción en 30 días netos o menos, contados desde el inicio de la primera fase hasta la implementación y descontando pausas. Los desestimados no entran en este cálculo.`);
  const pd = pctPausa(desa), pt = pctPausa(test);
  if (pd !== null || pt !== null) lectura.push(`Las pausas ocupan el ${pct(pd)} del tiempo calendario de desarrollo y el ${pct(pt)} del de testing. Es tiempo en que el SGR estuvo detenido, no tiempo de trabajo. El ${pct(calidad && calidad.horas_pausa_total ? calidad.horas_pausa_con_dev / calidad.horas_pausa_total : null)} de esas horas corresponde a SGR devueltos al cliente.`);
  if (sinDev?.lead_neto_med != null && conDev.length) {
    const peor = conDev.at(-1)!;
    lectura.push(`Sin devoluciones al cliente, la mediana de entrega es de ${dias(sinDev.lead_neto_med)} netos y ${dias(sinDev.lead_cal_med)} calendario; con ${GRUPOS[peor.grupo].toLowerCase()} pasa a ${dias(peor.lead_neto_med)} netos y ${dias(peor.lead_cal_med)} calendario. La diferencia entre calendario y neto es la espera del cliente.`);
    const idxSin = indice(sinDev);
    const dev = conDev.reduce((a, g) => ({ presu_reg: a.presu_reg + g.presu_reg, real_reg: a.real_reg + g.real_reg }), { presu_reg: 0, real_reg: 0 });
    const idxCon = indice(dev);
    if (idxSin !== null && idxCon !== null && idxCon < idxSin - 0.03) {
      lectura.push(`Los SGR devueltos también consumen más horas frente a lo presupuestado (índice ${num(idxCon, 2)} contra ${num(idxSin, 2)} sin devoluciones): retomar un SGR después de una consulta suele implicar volver a analizarlo.`);
    }
  }

  return (
    <>
      <Encabezado titulo={`Tiempos y devoluciones ${textoAnios(f)}`} op={op} f={f}
        bajada="Duración de cada fase y del ciclo completo, separando el tiempo calendario del tiempo en pausa. Las pausas incluyen la espera cuando un SGR se devuelve al cliente por falta de datos o consultas." />

      <section className="banda">
        <Indicador nombre="Desarrollo, mediana" valor={dias(desa.dias_netos_med)} nota={`${dias(desa.dias_cal_med)} calendario`} />
        <Indicador nombre="Testing, mediana" valor={dias(test.dias_netos_med)} nota={`${dias(test.dias_cal_med)} calendario`} />
        <Indicador nombre="Horas pausadas" valor={horas(desa.horas_pausadas + test.horas_pausadas)} nota="desarrollo y testing" />
        <Indicador nombre="Devueltos al cliente" valor={num(conDev.reduce((s, g) => s + g.sgr, 0))}
          nota={`de ${num(porDevolucion.reduce((s, g) => s + g.sgr, 0))} SGR entregados`} />
      </section>

      <Lectura parrafos={lectura} />
      {calidad && calidad.dev_sin_pausa > 0 && (
        <p className="aviso info">
          {num(calidad.dev_sin_pausa)} SGR entregados tienen devoluciones al cliente pero ninguna hora pausada registrada, así que esa espera no se puede descontar
          y su tiempo de entrega neto queda más largo de lo real. Registrar la pausa en cada devolución mejora la medición.
        </p>
      )}

      <div className="rejilla-2">
        <section className="panel">
          <h2>Duración por fase</h2>
          <div className="tabla-env">
            <table>
              <thead><tr><th /><th className="n">Desarrollo</th><th className="n">Testing</th></tr></thead>
              <tbody>
                <tr><td>SGR con la fase</td><td className="n">{num(desa.sgr)}</td><td className="n">{num(test.sgr)}</td></tr>
                <tr><td>Mediana en días calendario</td><td className="n">{dias(desa.dias_cal_med)}</td><td className="n">{dias(test.dias_cal_med)}</td></tr>
                <tr><td>Mediana sin pausas</td><td className="n">{dias(desa.dias_netos_med)}</td><td className="n">{dias(test.dias_netos_med)}</td></tr>
                <tr><td>Horas pausadas</td><td className="n">{horas(desa.horas_pausadas)}</td><td className="n">{horas(test.horas_pausadas)}</td></tr>
                <tr><td>Parte del tiempo en pausa</td><td className="n">{pct(pd)}</td><td className="n">{pct(pt)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-cab">
            <h2>Tiempo total de entrega</h2>
            <p>Inicio de la primera fase hasta la implementación, sin pausas.</p>
          </div>
          <BarrasH datos={tramos.map((t) => ({ etiqueta: TRAMOS[t.tramo - 1], valor: t.sgr }))} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-cab">
          <h2>Tiempo de entrega por servicio</h2>
          <p>Desde el inicio de la primera fase hasta la implementación. En «Solo testing» mide únicamente el servicio de testing.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr><th>Servicio</th><th className="n">SGR entregados</th><th className="n">Entrega, mediana sin pausas</th>
                <th className="n">Entrega, mediana calendario</th><th className="n">Pausa promedio por SGR</th></tr>
            </thead>
            <tbody>
              {porServicio.map((r) => (
                <tr key={r.servicio}>
                  <td><span className={`etiqueta ${claseServicio(r.servicio)}`}>{nombreServicio(r.servicio)}</span></td>
                  <td className="n">{num(r.sgr)}</td>
                  <td className="n">{dias(r.lead_neto_med)}</td>
                  <td className="n">{dias(r.lead_cal_med)}</td>
                  <td className="n">{horas(r.pausa_prom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>Impacto de las devoluciones al cliente</h2>
          <p>Mientras el cliente completa datos o responde consultas, el SGR queda detenido y la fecha de entrega se corre. Solo SGR entregados.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr>
                <th>Devoluciones</th><th className="n">SGR</th><th className="n">Entrega, mediana sin pausas</th>
                <th className="n">Entrega, mediana calendario</th><th className="n">Pausa promedio por SGR</th><th className="n">Índice de cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {porDevolucion.map((g) => (
                <tr key={g.grupo}>
                  <td>{GRUPOS[g.grupo]}</td>
                  <td className="n">{num(g.sgr)}</td>
                  <td className="n">{dias(g.lead_neto_med)}</td>
                  <td className="n">{dias(g.lead_cal_med)}</td>
                  <td className="n">{horas(g.pausa_prom)}</td>
                  <td className="n"><EtiquetaIndice valor={indice(g)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>SGR con más tiempo en pausa</h2>
          <p>Los que más corren la fecha de entrega sin consumir horas de trabajo. La entrega de un desestimado no se calcula.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr><th>SGR</th><th>Asunto</th><th>Desarrollo</th><th>Testing</th><th className="n">Devoluciones al cliente</th>
                <th className="n">Horas pausadas</th><th className="n">Entrega calendario</th><th className="n">Entrega sin pausas</th></tr>
            </thead>
            <tbody>
              {masPausados.map((r) => (
                <tr key={r.id_req}>
                  <td>{r.id_req}</td>
                  <td className="recorte" title={r.asunto ?? ""}>{r.asunto}</td>
                  <td>{r.asignado_a ?? "–"}</td>
                  <td>{r.asignado_testing ?? "–"}</td>
                  <td className="n">{num(r.devoluciones)}</td>
                  <td className="n">{horas(r.horas_pausadas)}</td>
                  <td className="n">{dias(r.lead_cal)}</td>
                  <td className="n">{dias(r.lead_neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
