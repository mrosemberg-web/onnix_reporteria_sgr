import { BotonExcel, TituloRegion } from "./BotonExcel";
import { BarraLibro, BarrasAcumulado, BarrasPresuReal, Dispersion, Distribucion } from "./graficos";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "./ui";
import { contextoReporte } from "@/lib/contexto";
import { textoAnios, type SearchParams } from "@/lib/filtros";
import { dias, horas, num, pct } from "@/lib/formato";
import { lecturaFase } from "@/lib/lectura";
import { fase, indice, pctPausa, type Fase } from "@/lib/reportes";

const TEXTO = {
  desa: {
    titulo: "Desarrollo",
    tituloLargo: "Desarrollo",
    persona: "Desarrollador",
    color: "var(--desa)",
    bajada:
      "Solo son desarrollos de Onnix los SGR con horas presupuestadas de desarrollo, en cualquier equipo; sin presupuesto de desarrollo no cuentan aunque tengan horas cargadas. Cada SGR se mide entre su fecha de inicio y fin de desarrollo.",
  },
  test: {
    titulo: "Testing",
    tituloLargo: "Testing como servicio adicional",
    persona: "Tester",
    color: "var(--test)",
    bajada:
      "Testing es un servicio adicional: se presta sobre desarrollos de Onnix y sobre desarrollos internos del cliente (por ejemplo, equipos DITA y DPJ). Cada SGR se mide entre su fecha de inicio y fin de testing, que no necesariamente sigue al fin de desarrollo.",
  },
} as const;

export async function PaginaFase({ fz, searchParams }: { fz: Fase; searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const t = TEXTO[fz];
  const { total, responsables, mensual, puntos, sinPresu } = await fase(fz, f);
  const esTest = fz === "test";
  const conHoras = total.sgr - total.sin_registro;
  const maxBarra = Math.max(1, ...responsables.map((r) => Math.max(r.horas_real, r.horas_presu)));

  let acc = 0, grupo: number | null = null;
  const entregas = mensual.map((m) => {
    if (m.anio !== grupo) { grupo = m.anio; acc = 0; } // acumulado por año; "Previo" va aparte
    acc += m.sgr;
    return { etiqueta: m.etiqueta, segmentos: esTest ? [m.sgr - m.solo_test, m.solo_test] : [m.sgr], acumulado: acc, grupo: m.anio };
  });
  const seriesEntregas = esTest
    ? [{ nombre: "Sobre desarrollos de Onnix", color: t.color },
       { nombre: "Sobre desarrollos del cliente", color: "color-mix(in srgb, var(--test) 45%, var(--superficie))", colorTexto: "var(--tinta)" }]
    : [{ nombre: "Desarrollos con fin de desarrollo en el mes", color: t.color }];

  return (
    <>
      <Encabezado titulo={`${t.tituloLargo} ${textoAnios(f)}`} bajada={t.bajada} op={op} f={f} />

      <section className="banda" aria-label={`Indicadores de ${t.titulo.toLowerCase()}`}>
        <Indicador nombre="SGR entregados" valor={num(total.entregados)}
          nota={[
            esTest ? `${num(total.entregados - total.solo_test_entregados)} de Onnix, ${num(total.solo_test_entregados)} del cliente` : "",
            total.desestimados ? `+${total.desestimados} desestimados` : "",
            total.sin_registro ? `${total.sin_registro} sin horas cargadas` : "",
          ].filter(Boolean).join("; ") || undefined} />
        <Indicador nombre="Horas trabajadas" valor={horas(total.real_reg)} nota={`de ${horas(total.presu_reg)} presupuestadas`} />
        <Indicador nombre="Índice de cumplimiento" valor={<EtiquetaIndice valor={indice(total)} />} nota="presupuestadas ÷ trabajadas" />
        <Indicador nombre="Dentro del presupuesto" valor={conHoras ? pct(total.dentro / conHoras) : "–"} nota={`${num(total.dentro)} de ${num(conHoras)} SGR`} />
        <Indicador nombre="Duración mediana" valor={dias(total.dias_netos_med)} nota={`días hábiles sin pausas; ${dias(total.dias_hab_med)} con pausas`} />
        <Indicador nombre="Devueltos al cliente" valor={num(total.sgr_con_devolucion)} nota={`SGR por falta de datos o consultas (${num(total.devoluciones)} devoluciones)`} />
      </section>

      <Lectura parrafos={lecturaFase(fz, total, responsables)} fase={fz} />
      {!esTest && sinPresu.sgr > 0 && (
        <p className="aviso info">
          {num(sinPresu.sgr)} SGR de equipos de Onnix tienen {horas(sinPresu.horas)} de desarrollo cargadas sin horas presupuestadas de desarrollo.
          No se cuentan como desarrollos entregados ni suman horas en este reporte.
        </p>
      )}

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="por_persona">Productividad por {t.persona.toLowerCase()}</TituloRegion>
          <p>La barra muestra horas trabajadas; la marca vertical, las presupuestadas. En rojo, el excedente.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr>
                <th>{t.persona}</th>
                <th className="n">SGR entregados</th>
                {esTest && <th className="n" title="SGR sobre desarrollos internos del cliente">Del cliente</th>}
                <th className="n">Trabajadas</th>
                <th className="n">Presupuestadas</th>
                <th aria-label="Comparación gráfica" />
                <th className="n">Desvío</th>
                <th className="n">Índice</th>
                <th className="n">En presupuesto</th>
                <th className="n">Horas por SGR</th>
                <th className="n">SGR por mes</th>
                <th className="n" title="SGR devueltos al cliente por falta de datos o consultas">Devueltos al cliente</th>
                <th className="n">Días netos</th>
                <th className="n">Pausa</th>
              </tr>
            </thead>
            <tbody>
              {responsables.map((r) => {
                const ch = r.sgr - r.sin_registro;
                return (
                  <tr key={r.responsable}>
                    <td>{r.responsable}</td>
                    <td className="n">
                      {num(r.entregados)}
                      {r.desestimados > 0 && <span className="debil" title="Desestimados por el cliente"> +{r.desestimados} desest.</span>}
                      {r.sin_registro > 0 && <span className="debil" title="SGR sin horas cargadas"> ({r.sin_registro} s/h)</span>}
                    </td>
                    {esTest && <td className="n">{r.solo_test ? num(r.solo_test) : ""}</td>}
                    <td className="n">{horas(r.horas_real)}</td>
                    <td className="n">{horas(r.horas_presu)}</td>
                    <td><BarraLibro real={r.horas_real} presu={r.horas_presu} max={maxBarra} color={t.color} /></td>
                    <td className="n" style={{ color: r.real_reg > r.presu_reg ? "var(--mal)" : undefined }}>
                      {r.real_reg - r.presu_reg > 0 ? "+" : ""}{horas(r.real_reg - r.presu_reg)}
                    </td>
                    <td className="n"><EtiquetaIndice valor={indice(r)} /></td>
                    <td className="n">{ch ? `${pct(r.dentro / ch)}` : "–"}</td>
                    <td className="n">{ch ? horas(r.real_reg / ch) : "–"}</td>
                    <td className="n">{r.meses_activos ? num(r.sgr / r.meses_activos, 1) : "–"}</td>
                    <td className="n">{r.sgr_con_devolucion ? num(r.sgr_con_devolucion) : ""}</td>
                    <td className="n">{dias(r.dias_netos_med)}</td>
                    <td className="n">{pct(pctPausa(r))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="n">{num(total.entregados)}{total.desestimados > 0 && <span className="debil"> +{total.desestimados}</span>}</td>
                {esTest && <td className="n">{num(total.solo_test)}</td>}
                <td className="n">{horas(total.horas_real)}</td>
                <td className="n">{horas(total.horas_presu)}</td>
                <td />
                <td className="n">{total.real_reg - total.presu_reg > 0 ? "+" : ""}{horas(total.real_reg - total.presu_reg)}</td>
                <td className="n"><EtiquetaIndice valor={indice(total)} /></td>
                <td className="n">{conHoras ? pct(total.dentro / conHoras) : "–"}</td>
                <td className="n">{conHoras ? horas(total.real_reg / conHoras) : "–"}</td>
                <td />
                <td className="n">{num(total.sgr_con_devolucion)}</td>
                <td className="n">{dias(total.dias_netos_med)}</td>
                <td className="n">{pct(pctPausa(total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="debil" style={{ marginTop: 12, fontSize: "0.82rem" }}>
          Desvío e índice se calculan solo sobre SGR con horas cargadas. «SGR por mes» divide los SGR por la cantidad de meses en que la persona cerró al menos uno.
          Días netos: mediana de duración de la fase descontando horas pausadas. Los desestimados se muestran aparte de los entregados, pero sus horas sí cuentan porque el trabajo se realizó.
          Las devoluciones son al cliente (falta de datos o consultas) y no reflejan la calidad del trabajo del equipo.
        </p>
      </section>

      <div className="rejilla-2">
        <section className="panel">
          <div className="panel-cab">
            <TituloRegion region="por_mes">SGR con {t.titulo.toLowerCase()} terminado, por mes</TituloRegion>
            <p>Según la fecha de fin de {fz === "desa" ? "desarrollo" : "testing"}.{mensual.some((m) => m.previo) && " «Previo» agrupa los que terminaron antes del período elegido."}</p>
          </div>
          <BarrasAcumulado datos={entregas} series={seriesEntregas} />
        </section>
        <section className="panel">
          <div className="panel-cab">
            <h2>Distribución por desvío</h2>
            <p>Cuántos SGR quedaron dentro de lo presupuestado.</p>
          </div>
          <Distribucion dentro={total.dentro} leve={total.leve} sobre={total.sobre} sinRegistro={total.sin_registro} />
          <div className="titulo-region" style={{ marginTop: 24 }}><h3>Horas por mes de fin de fase</h3><BotonExcel region="horas_mes" /></div>
          <BarrasPresuReal color={t.color}
            datos={mensual.map((m) => ({ etiqueta: m.etiqueta, presu: m.horas_presu, real: m.horas_real }))} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="precision">Precisión de la estimación por SGR</TituloRegion>
          <p>{num(puntos.length)} SGR. Pasá el cursor por un punto para ver el detalle.</p>
        </div>
        <div style={{ maxWidth: 720 }}>
          <Dispersion puntos={puntos} color={t.color} />
        </div>
      </section>
    </>
  );
}
