import { BarrasAcumulado, BarrasPresuReal, Distribucion } from "@/components/graficos";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import { textoAnios, type SearchParams } from "@/lib/filtros";
import { dias, fechaHora, gsCorto, horas, num, pct } from "@/lib/formato";
import { lecturaResumen } from "@/lib/lectura";
import { indice, pctPausa, resumen, type AggFase } from "@/lib/reportes";

export const dynamic = "force-dynamic";

export default async function PaginaResumen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;

  const { kpis, desa, test, mensual, mesEnCurso } = await resumen(f);
  const anios = textoAnios(f);
  const varios = f.anios.length > 1;
  const conDesarrollos = mensual.filter((m) => m.desarrollos > 0);
  const promedio = conDesarrollos.length ? kpis.desarrollos_entregados / conDesarrollos.length : 0;
  const idxGlobal = indice({ presu_reg: desa.presu_reg + test.presu_reg, real_reg: desa.real_reg + test.real_reg });

  return (
    <>
      <Encabezado titulo={`Resumen ${anios}`} op={op} f={f}
        bajada={<>SGR implementados en {anios}. {op.ultimaCarga && <>Datos de «{op.ultimaCarga.archivo}», cargados el {fechaHora(op.ultimaCarga.cargado_en)}</>}</>} />

      <section className="panel heroe" aria-labelledby="t-entregas">
        <div className="heroe-cifra">
          <div>
            <h2 id="t-entregas">Desarrollos entregados {varios ? `en ${anios}` : `en lo que va de ${anios}`}</h2>
            <div className="grande" style={{ marginTop: 14 }}>{num(kpis.desarrollos_entregados)}</div>
          </div>
          <div className="heroe-servicio">
            <p><strong>Testing como servicio adicional</strong> en {num(kpis.testing_entregados)} SGR:</p>
            <p>{num(kpis.testing_onnix)} sobre desarrollos de Onnix y {num(kpis.testing_cliente)} sobre desarrollos internos del cliente.</p>
            <p className="debil">Promedio de {num(promedio, 1)} desarrollos por mes con entregas.
              {kpis.desestimados > 0 && <> Sin contar {num(kpis.desestimados)} SGR desestimados por el cliente.</>}</p>
          </div>
        </div>
        <BarrasAcumulado
          series={[
            { nombre: "Desarrollos entregados", color: "var(--desa)" },
            { nombre: "Solo testing (desarrollo del cliente)", color: "var(--test)" },
          ]}
          nombreLinea={varios ? "Desarrollos acumulados en cada año (eje derecho)" : "Desarrollos acumulados del año (eje derecho)"}
          datos={mensual.map((m) => ({ etiqueta: m.etiqueta, segmentos: [m.desarrollos, m.solo_test], acumulado: m.acumulado_desa, grupo: m.anio }))}
          resaltarUltimo={mesEnCurso} />
      </section>

      <section className="banda" aria-label="Indicadores">
        <Indicador nombre="Horas trabajadas" valor={horas(kpis.horas_real_total)} nota={`de ${horas(kpis.horas_presu_total)} presupuestadas`} />
        <Indicador nombre="Índice de cumplimiento" valor={<EtiquetaIndice valor={idxGlobal} />} nota="presupuestadas ÷ trabajadas" />
        <Indicador nombre="Tiempo de entrega" valor={dias(kpis.lead_neto_med)} nota={`mediana sin pausas; ${dias(kpis.lead_cal_med)} calendario`} />
        <Indicador nombre="Devueltos al cliente" valor={pct(kpis.sgr ? kpis.sgr_con_devolucion / kpis.sgr : 0)}
          nota={`${num(kpis.sgr_con_devolucion)} SGR por falta de datos o consultas`} />
        <Indicador nombre="Desestimados por el cliente" valor={num(kpis.desestimados)}
          nota={kpis.desestimados ? `${horas(kpis.horas_desestimados)} consumidas` : "ninguno"} />
        <Indicador nombre="Facturado" valor={gsCorto(kpis.facturado)}
          nota={`${gsCorto(kpis.facturado_desa)} desarrollo; ${gsCorto(kpis.facturado_test)} testing`} />
      </section>

      <Lectura parrafos={lecturaResumen(kpis, desa, test)} />

      <section className="fases">
        <ResumenFase nombre="Desarrollo" clase="desa" a={desa}
          extra={kpis.desa_sin_presu > 0 ? <p className="debil" style={{ marginTop: 12, fontSize: "0.82rem" }}>
            No se cuentan {num(kpis.desa_sin_presu)} SGR con {horas(kpis.horas_desa_sin_presu)} de desarrollo cargadas sin presupuesto de desarrollo.</p> : null} />
        <ResumenFase nombre="Testing (servicio adicional)" clase="test" a={test}
          filasExtra={<>
            <dt>Sobre desarrollos de Onnix</dt><dd>{num(test.sgr - test.solo_test)}</dd>
            <dt>Sobre desarrollos del cliente</dt><dd>{num(test.solo_test)}</dd>
          </>} />
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>Horas presupuestadas y trabajadas por mes de implementación</h2>
          <p>Desarrollo y testing sumados. Solo cuentan horas de desarrollo con presupuesto de desarrollo.</p>
        </div>
        <BarrasPresuReal color="var(--desa)"
          datos={mensual.map((m) => ({ etiqueta: m.etiqueta, presu: m.horas_presu, real: m.horas_real }))} />
      </section>
    </>
  );
}

function ResumenFase({ nombre, clase, a, filasExtra, extra }: {
  nombre: string; clase: "desa" | "test"; a: AggFase; filasExtra?: React.ReactNode; extra?: React.ReactNode;
}) {
  const conHoras = a.sgr - a.sin_registro;
  return (
    <article className={`panel fase ${clase}`}>
      <h2>{nombre}</h2>
      <dl>
        <dt>SGR con esta fase</dt><dd>{num(a.sgr)}</dd>
        {filasExtra}
        <dt>Horas trabajadas</dt><dd>{horas(a.real_reg)}</dd>
        <dt>Horas presupuestadas (de esos SGR)</dt><dd>{horas(a.presu_reg)}</dd>
        <dt>Índice de cumplimiento</dt><dd><EtiquetaIndice valor={indice(a)} /></dd>
        <dt>Dentro del presupuesto</dt><dd>{conHoras ? pct(a.dentro / conHoras) : "–"}</dd>
        <dt>Duración mediana</dt><dd>{dias(a.dias_netos_med)} netos, {dias(a.dias_cal_med)} calendario</dd>
        <dt>Tiempo en pausa</dt><dd>{pct(pctPausa(a))}</dd>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Distribucion dentro={a.dentro} leve={a.leve} sobre={a.sobre} sinRegistro={a.sin_registro} />
      </div>
      {extra}
    </article>
  );
}
