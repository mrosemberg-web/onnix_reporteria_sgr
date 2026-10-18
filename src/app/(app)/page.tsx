import { BarrasAcumulado, BarrasPresuReal, Distribucion } from "@/components/graficos";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import type { SearchParams } from "@/lib/filtros";
import { dias, fechaHora, gsCorto, horas, MESES, MESES_LARGOS, num, pct } from "@/lib/formato";
import { lecturaResumen } from "@/lib/lectura";
import { indice, pctPausa, resumen, type AggFase } from "@/lib/reportes";

export const dynamic = "force-dynamic";

export default async function PaginaResumen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;

  const r = await resumen(f);
  const { kpis, desa, test, mensual } = r;
  const acumulado = mensual.at(-1)?.acumulado ?? 0;
  const conDatos = mensual.filter((m) => m.sgr > 0);
  const ultimoConDatos = conDatos.at(-1);
  const promedio = conDatos.length ? acumulado / conDatos.length : 0;
  const idxGlobal = indice({ presu_reg: desa.presu_reg + test.presu_reg, real_reg: desa.real_reg + test.real_reg });
  const mesEnCursoVisible = mensual.length === r.mesEnCurso && new Date().getFullYear() === f.anio;

  const lectura = lecturaResumen(kpis, desa, test);

  return (
    <>
      <Encabezado titulo={`Resumen ${f.anio}`} op={op} f={f}
        bajada={<>SGR implementados en {f.anio}. {op.ultimaCarga && <>Datos de «{op.ultimaCarga.archivo}», cargados el {fechaHora(op.ultimaCarga.cargado_en)}</>}</>} />

      <section className="panel heroe" aria-labelledby="t-entregas">
        <div className="heroe-cifra">
          <div>
            <h2 id="t-entregas">SGR entregados en lo que va de {f.anio}</h2>
            <div className="grande" style={{ marginTop: 14 }}>{num(acumulado)}</div>
          </div>
          <p>
            Promedio de {num(promedio, 1)} por mes con entregas.
            {kpis.desestimados > 0 && <> Sin contar {num(kpis.desestimados)} desestimados por el cliente.</>}
            {ultimoConDatos && <> En {MESES_LARGOS[ultimoConDatos.mes - 1]} se entregaron {num(ultimoConDatos.sgr)}.</>}
          </p>
        </div>
        <BarrasAcumulado
          datos={mensual.map((m) => ({ etiqueta: MESES[m.mes - 1], valor: m.sgr, acumulado: m.acumulado }))}
          resaltarUltimo={mesEnCursoVisible} />
      </section>

      <section className="banda" aria-label="Indicadores del año">
        <Indicador nombre="Horas trabajadas" valor={horas(kpis.horas_real_total)} nota={`de ${horas(kpis.horas_presu_total)} presupuestadas`} />
        <Indicador nombre="Índice de cumplimiento" valor={<EtiquetaIndice valor={idxGlobal} />} nota="presupuestadas ÷ trabajadas" />
        <Indicador nombre="Tiempo de entrega" valor={dias(kpis.lead_neto_med)} nota={`mediana sin pausas; ${dias(kpis.lead_cal_med)} calendario`} />
        <Indicador nombre="Devueltos al cliente" valor={pct(kpis.sgr ? kpis.sgr_con_devolucion / kpis.sgr : 0)}
          nota={`${num(kpis.sgr_con_devolucion)} SGR por falta de datos o consultas`} />
        <Indicador nombre="Desestimados por el cliente" valor={num(kpis.desestimados)}
          nota={kpis.desestimados ? `${horas(kpis.horas_desestimados)} consumidas` : "ninguno"} />
        <Indicador nombre="Facturado" valor={gsCorto(kpis.facturado)}
          nota={kpis.sgr_pendiente_facturar ? `${gsCorto(kpis.pendiente_facturar)} en ${kpis.sgr_pendiente_facturar} SGR sin fecha de facturación` : "todo con fecha de facturación"} />
      </section>

      <Lectura parrafos={lectura} />

      <section className="fases">
        <ResumenFase nombre="Desarrollo" clase="desa" a={desa} />
        <ResumenFase nombre="Testing" clase="test" a={test} />
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>Horas presupuestadas y trabajadas por mes de implementación</h2>
          <p>Desarrollo y testing sumados, según las reglas de cada equipo.</p>
        </div>
        <BarrasPresuReal color="var(--desa)"
          datos={mensual.map((m) => ({ etiqueta: MESES[m.mes - 1], presu: m.horas_presu, real: m.horas_real }))} />
      </section>
    </>
  );
}

function ResumenFase({ nombre, clase, a }: { nombre: string; clase: "desa" | "test"; a: AggFase }) {
  const conHoras = a.sgr - a.sin_registro;
  return (
    <article className={`panel fase ${clase}`}>
      <h2>{nombre}</h2>
      <dl>
        <dt>SGR con esta fase</dt><dd>{num(a.sgr)}</dd>
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
    </article>
  );
}
