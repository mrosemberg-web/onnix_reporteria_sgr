import { BarraLibro, BarrasAcumulado, BarrasPresuReal, Dispersion, Distribucion } from "./graficos";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "./ui";
import { contextoReporte } from "@/lib/contexto";
import type { SearchParams } from "@/lib/filtros";
import { dias, horas, nombreMes, num, pct } from "@/lib/formato";
import { lecturaFase } from "@/lib/lectura";
import { fase, indice, pctPausa, type Fase } from "@/lib/reportes";

const TEXTO = {
  desa: {
    titulo: "Desarrollo",
    persona: "Desarrollador",
    color: "var(--desa)",
    bajada:
      "Cada SGR se mide entre su fecha de inicio y fin de desarrollo. En los equipos DITA y DPJ el desarrollo lo hace el cliente, así que solo se incluye si el SGR tiene horas presupuestadas de desarrollo.",
  },
  test: {
    titulo: "Testing",
    persona: "Tester",
    color: "var(--test)",
    bajada:
      "Cada SGR se mide entre su fecha de inicio y fin de testing, que no necesariamente sigue al fin de desarrollo. Incluye todos los equipos, también DITA y DPJ.",
  },
} as const;

export async function PaginaFase({ fz, searchParams }: { fz: Fase; searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const t = TEXTO[fz];
  const { total, responsables, mensual, puntos } = await fase(fz, f);
  const conHoras = total.sgr - total.sin_registro;
  const maxBarra = Math.max(1, ...responsables.map((r) => Math.max(r.horas_real, r.horas_presu)));

  let acc = 0;
  const entregas = mensual.map((m) => ({ etiqueta: nombreMes(m.mes), valor: m.sgr, acumulado: (acc += m.sgr) }));

  return (
    <>
      <Encabezado titulo={`${t.titulo} ${f.anio}`} bajada={t.bajada} op={op} f={f} />

      <section className="banda" aria-label={`Indicadores de ${t.titulo.toLowerCase()}`}>
        <Indicador nombre="SGR entregados" valor={num(total.entregados)}
          nota={[total.desestimados ? `+${total.desestimados} desestimados` : "", total.sin_registro ? `${total.sin_registro} sin horas cargadas` : ""].filter(Boolean).join("; ") || undefined} />
        <Indicador nombre="Horas trabajadas" valor={horas(total.real_reg)} nota={`de ${horas(total.presu_reg)} presupuestadas`} />
        <Indicador nombre="Índice de cumplimiento" valor={<EtiquetaIndice valor={indice(total)} />} nota="presupuestadas ÷ trabajadas" />
        <Indicador nombre="Dentro del presupuesto" valor={conHoras ? pct(total.dentro / conHoras) : "–"} nota={`${num(total.dentro)} de ${num(conHoras)} SGR`} />
        <Indicador nombre="Duración mediana" valor={dias(total.dias_netos_med)} nota={`sin pausas; ${dias(total.dias_cal_med)} calendario`} />
        <Indicador nombre="Devueltos al cliente" valor={num(total.sgr_con_devolucion)} nota={`SGR por falta de datos o consultas (${num(total.devoluciones)} devoluciones)`} />
      </section>

      <Lectura parrafos={lecturaFase(fz, total, responsables)} fase={fz} />

      <section className="panel">
        <div className="panel-cab">
          <h2>Productividad por {t.persona.toLowerCase()}</h2>
          <p>La barra muestra horas trabajadas; la marca vertical, las presupuestadas. En rojo, el excedente.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead>
              <tr>
                <th>{t.persona}</th>
                <th className="n">SGR entregados</th>
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
            <h2>SGR con {t.titulo.toLowerCase()} terminado, por mes</h2>
            <p>Según la fecha de fin de {fz === "desa" ? "desarrollo" : "testing"}.{mensual.some((m) => m.mes === 0) && " «Previo» agrupa los que terminaron antes del año."}</p>
          </div>
          <BarrasAcumulado datos={entregas} color={t.color} />
        </section>
        <section className="panel">
          <div className="panel-cab">
            <h2>Distribución por desvío</h2>
            <p>Cuántos SGR quedaron dentro de lo presupuestado.</p>
          </div>
          <Distribucion dentro={total.dentro} leve={total.leve} sobre={total.sobre} sinRegistro={total.sin_registro} />
          <h3 style={{ marginTop: 24 }}>Horas por mes de fin de fase</h3>
          <BarrasPresuReal color={t.color}
            datos={mensual.map((m) => ({ etiqueta: nombreMes(m.mes), presu: m.horas_presu, real: m.horas_real }))} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-cab">
          <h2>Precisión de la estimación por SGR</h2>
          <p>{num(puntos.length)} SGR. Pasá el cursor por un punto para ver el detalle.</p>
        </div>
        <div style={{ maxWidth: 720 }}>
          <Dispersion puntos={puntos} color={t.color} />
        </div>
      </section>
    </>
  );
}
