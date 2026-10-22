import { BarrasApiladasH, DispersionAvance } from "@/components/graficos";
import { EncabezadoSeguimiento, LeyendaCausas, SinSeguimiento, TablaSgr } from "@/components/seguimiento-ui";
import { Indicador, Lectura } from "@/components/ui";
import { requerirSesion } from "@/lib/auth";
import type { SearchParams } from "@/lib/filtros";
import { dias, fecha, gsCorto, horas, num, pct } from "@/lib/formato";
import { lecturaSeguimiento } from "@/lib/lectura-seguimiento";
import { aplicarFiltros, cargarSeguimiento, leerFiltrosSeguimiento, opcionesSeguimiento } from "@/lib/seguimiento";
import {
  CAUSAS, EJECUCION, ETAPAS, mediana, ORDEN_CAUSAS, ORDEN_ETAPAS, resumir, type Ejecucion,
} from "@/lib/seguimiento-calculo";

export const dynamic = "force-dynamic";
export const metadata = { title: "En curso" };

const FASE = { desa: "Desarrollo", test: "Testing" } as const;

export default async function EnCurso({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sesion = await requerirSesion();
  const [{ analisis, cargas, corte }, sp] = await Promise.all([cargarSeguimiento(), searchParams]);
  if (!analisis.length) return <SinSeguimiento esAdmin={sesion.rol === "admin"} />;
  const f = leerFiltrosSeguimiento(sp);
  const op = opcionesSeguimiento(analisis);
  const items = aplicarFiltros(analisis, f);
  const sgr = items.filter((a) => a.etapa !== "sin_asignacion");
  const porFase = { desa: sgr.filter((a) => a.fase === "desa"), test: sgr.filter((a) => a.fase === "test") };
  const r = resumir(items);
  const rd = resumir(porFase.desa), rt = resumir(porFase.test);
  const conFecha = sgr.filter((a) => ["atrasado", "vence_pronto", "en_plazo"].includes(a.situacion)).length;
  const cliente = sgr.filter((a) => a.etapa === "cliente").sort((a, b) => (b.diasEnEstado ?? 0) - (a.diasEnEstado ?? 0));
  const personas = new Set(items.map((a) => a.usuario));
  const sinHorasAyer = [...personas].filter((p) => items.filter((a) => a.usuario === p).every((a) => a.horas_ayer === 0));
  const masAtrasados = sgr.filter((a) => a.situacion === "atrasado").sort((a, b) => (b.atraso ?? 0) - (a.atraso ?? 0)).slice(0, 12);
  const activos = sgr.filter((a) => a.etapa === "activo" && a.avance != null && a.consumo != null);
  const ejecPorTipo = (fz: "desa" | "test", t: Ejecucion) => porFase[fz].filter((a) => a.etapa !== "finalizado" && a.ejecucion === t);

  return (
    <>
      <EncabezadoSeguimiento titulo="Requerimientos en curso" op={op} f={f} cargas={cargas}
        bajada="Cómo vienen en el tiempo los SGR que todavía no llegaron a producción y por qué se atrasan: espera del cliente, devoluciones de testing o ejecución del equipo. El atraso se mide en días hábiles contra la entrega estimada original." />

      <section className="banda" aria-label="Indicadores">
        <Indicador nombre="SGR en curso" valor={num(sgr.length)} nota={`${num(porFase.desa.length)} en desarrollo, ${num(porFase.test.length)} en testing`} />
        <Indicador nombre="Atrasados" valor={num(r.atrasados)} nota={conFecha ? `${pct(r.atrasados / conFecha)} de los que tienen fecha` : undefined} />
        <Indicador nombre="Días hábiles de atraso" valor={num(r.diasAtraso)}
          nota={r.diasAtraso ? `${pct((r.causas.pausas + r.causas.cliente) / r.diasAtraso)} por cliente y pausas anteriores; ${pct(r.causas.ejecucion / r.diasAtraso)} por ejecución` : undefined} />
        <Indicador nombre="Esperando al cliente" valor={num(cliente.length)}
          nota={cliente.length ? `mediana de ${dias(mediana(cliente.map((a) => a.diasEnEstado ?? 0)))} en espera` : undefined} />
        <Indicador nombre="Devoluciones de testing" valor={num(r.devoluciones)} nota={`en ${num(r.sgrConDevolucion)} SGR; ${num(r.devueltosAhora)} devueltos hoy`} />
        <Indicador nombre="Horas cargadas ayer" valor={horas(r.horasAyer)}
          nota={`${num(personas.size - sinHorasAyer.length)} de ${num(personas.size)} personas`} />
        <Indicador nombre="Cartera en curso" valor={gsCorto(r.importe)} nota="importe total presupuestado" />
      </section>

      <Lectura parrafos={lecturaSeguimiento(items)} />

      <section className="panel">
        <div className="panel-cab">
          <h2>¿Por qué se atrasan?</h2>
          <p>Días hábiles de atraso de los SGR que todavía no terminaron su fase, según la causa.</p>
        </div>
        <BarrasApiladasH series={ORDEN_CAUSAS.map((c) => ({ nombre: CAUSAS[c].nombre, color: CAUSAS[c].color }))}
          formato={(v) => num(v)} leyenda={false}
          filas={[
            { etiqueta: "Desarrollo", segmentos: ORDEN_CAUSAS.map((c) => rd.causas[c]) },
            { etiqueta: "Testing", segmentos: ORDEN_CAUSAS.map((c) => rt.causas[c]) },
          ]} />
        <LeyendaCausas />
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>Dónde están hoy</h2>
          <p>SGR por etapa del flujo.</p>
        </div>
        <BarrasApiladasH anchoEtiqueta={110}
          series={ORDEN_ETAPAS.map((e) => ({ nombre: ETAPAS[e].nombre, color: ETAPAS[e].color }))}
          filas={[
            { etiqueta: "Desarrollo", segmentos: ORDEN_ETAPAS.map((e) => rd.porEtapa[e]) },
            { etiqueta: "Testing", segmentos: ORDEN_ETAPAS.map((e) => rt.porEtapa[e]) },
          ]} />
      </section>
      <section className="panel">
        <div className="panel-cab">
          <h2>Atraso por ejecución: ¿lentitud o subestimación?</h2>
          <p>SGR con atraso que no explican las pausas ni las devoluciones.</p>
        </div>
        <div className="tabla-env">
          <table>
            <thead><tr><th>Diagnóstico</th><th className="n">Desarrollo</th><th className="n">Testing</th><th className="n">Días</th></tr></thead>
            <tbody>
              {(Object.keys(EJECUCION) as Ejecucion[]).map((t) => {
                const d = ejecPorTipo("desa", t), te = ejecPorTipo("test", t);
                return (
                  <tr key={t}>
                    <td><strong>{EJECUCION[t].nombre}</strong><br /><span className="debil" style={{ fontSize: "0.8rem" }}>{EJECUCION[t].ayuda}</span></td>
                    <td className="n">{num(d.length)}</td>
                    <td className="n">{num(te.length)}</td>
                    <td className="n">{num([...d, ...te].reduce((s, a) => s + a.causas.ejecucion, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-cab">
          <h2>SGR en trabajo: horas usadas contra plazo transcurrido</h2>
          <p>{num(activos.length)} SGR en trabajo con fecha y presupuesto. Pasá el cursor sobre un punto para ver el SGR.</p>
        </div>
        <div style={{ maxWidth: 720 }}>
          <DispersionAvance puntos={activos.map((a) => ({
            id: `${a.fase}-${a.id_req}`, avance: a.avance!, consumo: a.consumo!,
            color: a.fase === "desa" ? "var(--desa)" : "var(--test)",
            texto: `SGR ${a.id_req} (${FASE[a.fase]}, ${a.nombre ?? a.usuario}): ${pct(a.consumo)} de las horas, ${pct(a.avance)} del plazo`,
          }))} />
          <div className="leyenda"><span><i style={{ background: "var(--desa)" }} />Desarrollo</span><span><i style={{ background: "var(--test)" }} />Testing</span></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab">
          <h2>Los SGR más atrasados</h2>
          <p>La línea muestra el plan (azul), el corrimiento por pausas (gris) y el atraso (rojo); la marca negra es la fecha de corte. Atraso en días hábiles.</p>
        </div>
        <TablaSgr items={masAtrasados} corte={corte} />
      </section>

      {cliente.length > 0 && (
        <section className="panel">
          <div className="panel-cab">
            <h2>Esperando al cliente</h2>
            <p>Para gestionar con el cliente, del que más tiempo lleva esperando al más reciente.</p>
          </div>
          <div className="tabla-env">
            <table>
              <thead><tr><th>SGR</th><th>Asunto</th><th>Fase</th><th>Responsable</th><th>Estado</th><th>Desde</th><th className="n">Días hábiles esperando</th><th className="n">Atraso</th></tr></thead>
              <tbody>
                {cliente.map((a) => (
                  <tr key={`${a.fase}-${a.id_req}`}>
                    <td>{a.id_req}</td>
                    <td className="recorte" title={a.asunto ?? ""}>{a.asunto}</td>
                    <td>{FASE[a.fase]}</td>
                    <td>{a.nombre ?? a.usuario}</td>
                    <td>{a.estado}</td>
                    <td>{fecha(a.fecha_estado)}</td>
                    <td className="n">{num(a.diasEnEstado)}</td>
                    <td className="n">{a.atraso ? `${num(a.atraso)} d` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
