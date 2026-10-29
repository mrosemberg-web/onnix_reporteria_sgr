import { TituloRegion } from "./BotonExcel";
import { BarrasApiladasH } from "./graficos";
import { EncabezadoSeguimiento, LeyendaCausas, SinSeguimiento, TablaSgr } from "./seguimiento-ui";
import { Indicador, Lectura } from "./ui";
import { requerirSesion } from "@/lib/auth";
import type { SearchParams } from "@/lib/filtros";
import { dias, horas, num, pct } from "@/lib/formato";
import { lecturaSeguimiento } from "@/lib/lectura-seguimiento";
import { aplicarFiltros, cargarSeguimiento, leerFiltrosSeguimiento, opcionesSeguimiento } from "@/lib/seguimiento";
import {
  agruparPorPersona, CAUSAS, devolucionesPorDesarrollador, ETIQUETA_DEVOLUCIONES, ORDEN_CAUSAS, porDevolucionesTesting, resumir,
  type Analisis,
} from "@/lib/seguimiento-calculo";

const TEXTO = {
  desa: { titulo: "Desarrollo en curso", persona: "Desarrollador", color: "var(--desa)",
    bajada: "SGR que hoy están en manos de desarrollo: en análisis, en cola, en trabajo o esperando al cliente." },
  test: { titulo: "Testing en curso", persona: "Tester", color: "var(--test)",
    bajada: "SGR que hoy están en testing. Las devoluciones al desarrollador (actualización de fuentes o errores encontrados) frenan al tester mientras espera la corrección." },
} as const;

const ORDEN_SITUACION = { atrasado: 0, vence_pronto: 1, en_plazo: 2, fin_tarde: 3, replanificacion: 4, sin_plan: 5, fin_a_tiempo: 6, sin_asignacion: 7 };

export async function PaginaSeguimientoFase({ fz, searchParams }: { fz: "desa" | "test"; searchParams: Promise<SearchParams> }) {
  const sesion = await requerirSesion();
  const [{ analisis, cargas, corte }, sp] = await Promise.all([cargarSeguimiento(), searchParams]);
  const deFase = analisis.filter((a) => a.fase === fz);
  if (!deFase.length) return <SinSeguimiento esAdmin={sesion.rol === "admin"} />;
  const t = TEXTO[fz];
  const f = leerFiltrosSeguimiento(sp);
  const op = opcionesSeguimiento(deFase);
  const items = aplicarFiltros(deFase, { ...f, fases: [] });
  const sgr = items.filter((a) => a.etapa !== "sin_asignacion");
  const r = resumir(items);

  const personas = agruparPorPersona(items);

  // Devoluciones de testing atribuidas a cada desarrollador (columna Desarrollador del CSV de testing).
  const hayDesarrollador = analisis.some((a) => a.fase === "test" && a.desarrollador);
  const liderDe = new Map(deFase.map((a) => [a.usuario, a.lider]));
  const devs = fz === "desa" ? devolucionesPorDesarrollador(analisis.filter((a) =>
    a.fase === "test" &&
    (!f.personas.length || (a.devUsuario != null && f.personas.includes(a.devUsuario))) &&
    (!f.lideres.length || (a.devUsuario != null && f.lideres.includes(liderDe.get(a.devUsuario) ?? ""))) &&
    (!f.servicios.length || (a.tipo_servicio != null && f.servicios.includes(a.tipo_servicio))))) : [];
  const devDe = new Map(devs.filter((d) => d.usuario).map((d) => [d.usuario!, d]));
  const mostrarDev = fz === "test" || hayDesarrollador || personas.some((p) => p.r.causas.devoluciones > 0);
  const conAtraso = personas.filter((p) => p.r.diasAtraso > 0);

  const ordenados = [...sgr].sort((a, b) =>
    ORDEN_SITUACION[a.situacion] - ORDEN_SITUACION[b.situacion] || (b.atraso ?? 0) - (a.atraso ?? 0) || (b.diasEnEstado ?? 0) - (a.diasEnEstado ?? 0));

  return (
    <>
      <EncabezadoSeguimiento titulo={t.titulo} bajada={t.bajada} op={op} f={f} cargas={cargas.filter((c) => c.tipo === `seguimiento_${fz}`)} mostrarFase={false} />

      <section className="banda">
        <Indicador nombre="SGR" valor={num(r.sgr)} nota={`${num(r.porEtapa.activo)} en trabajo; ${num(r.porEtapa.cola)} en cola; ${num(r.porEtapa.planificacion)} en análisis`} />
        <Indicador nombre="Atrasados" valor={num(r.atrasados)} nota={`${num(r.diasAtraso)} días acumulados`} />
        <Indicador nombre="Atraso por ejecución" valor={pct(r.diasAtraso ? r.causas.ejecucion / r.diasAtraso : 0)} nota={`${num(r.causas.ejecucion)} días`} />
        <Indicador nombre="Esperando al cliente" valor={num(r.esperandoCliente)} nota={`${num(r.causas.cliente + r.causas.pausas)} días de atraso por cliente y pausas anteriores`} />
        {fz === "test"
          ? <Indicador nombre="Devoluciones al desarrollador" valor={num(r.devoluciones)} nota={`en ${num(r.sgrConDevolucion)} SGR; ${num(r.devueltosAhora)} devueltos hoy`} />
          : <Indicador nombre="Excedidos en horas" valor={num(r.excedidos)} nota={`${horas(r.horasExcedidas)} por encima del presupuesto`} />}
        <Indicador nombre="Horas usadas" valor={pct(r.presuConTrab ? r.trabConPresu / r.presuConTrab : null)} nota={`${horas(r.trabConPresu)} de ${horas(r.presuConTrab)} presupuestadas`} />
        <Indicador nombre="Horas cargadas ayer" valor={horas(r.horasAyer)} nota={`${num(personas.filter((p) => p.r.horasAyer > 0).length)} de ${num(personas.length)} personas`} />
      </section>

      <Lectura parrafos={lecturaSeguimiento(items)} fase={fz} />

      {conAtraso.length > 0 && (
        <section className="panel">
          <div className="panel-cab">
            <TituloRegion region="atraso_persona">Días de atraso por {t.persona.toLowerCase()} y causa</TituloRegion>
            <p>Lo que está en rojo es atraso que no explican las pausas, el cliente ni las devoluciones.</p>
          </div>
          <BarrasApiladasH anchoEtiqueta={170}
            series={ORDEN_CAUSAS.map((c) => ({ nombre: CAUSAS[c].nombre, color: CAUSAS[c].color }))}
            leyenda={false}
            filas={conAtraso.map((p) => ({ etiqueta: p.nombre.split(" ").slice(0, 2).join(" "), segmentos: ORDEN_CAUSAS.map((c) => p.r.causas[c]) }))} />
          <LeyendaCausas />
        </section>
      )}

      <section className="panel">
        <TituloRegion region="por_persona">Por {t.persona.toLowerCase()}</TituloRegion>
        <div className="tabla-env">
          <table>
            <thead>
              <tr>
                <th>{t.persona}</th><th>Líder</th><th className="n">SGR</th><th className="n">En trabajo</th><th className="n">Cliente</th>
                {fz === "test" && <th className="n">Devoluciones</th>}
                {fz === "desa" && mostrarDev && <th className="n">Devoluciones recibidas</th>}
                <th className="n">Atrasados</th><th className="n">Atraso externo</th>
                {mostrarDev && <th className="n">{fz === "test" ? "Esperando corrección del desarrollador" : "Atraso por devoluciones"}</th>}
                <th className="n">Pausa sin motivo</th><th className="n">Atraso por ejecución</th><th className="n">Horas ayer</th><th className="n">Horas usadas</th><th className="n">Excedidos</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.usuario}>
                  <td className="nombre">{p.nombre}{p.items.some((a) => a.etapa === "sin_asignacion") && <span className="etiqueta e-neutro" style={{ marginLeft: 6 }}>Sin SGR asignado</span>}</td>
                  <td>{p.lider}</td>
                  <td className="n">{num(p.r.sgr)}</td>
                  <td className="n">{num(p.r.porEtapa.activo)}</td>
                  <td className="n">{num(p.r.esperandoCliente)}</td>
                  {fz === "test" && <td className="n">{num(p.r.devoluciones)}</td>}
                  {fz === "desa" && mostrarDev && <td className="n">{num(devDe.get(p.usuario)?.devoluciones ?? 0)}</td>}
                  <td className="n">{num(p.r.atrasados)}</td>
                  <td className="n">{dias(p.r.causas.pausas + p.r.causas.cliente)}</td>
                  {mostrarDev && <td className="n">{dias(p.r.causas.devoluciones + (fz === "desa" ? devDe.get(p.usuario)?.atraso ?? 0 : 0))}</td>}
                  <td className="n">{dias(p.r.causas.pausa)}</td>
                  <td className="n" style={{ color: p.r.causas.ejecucion > 0 ? "var(--mal)" : undefined }}>{dias(p.r.causas.ejecucion)}</td>
                  <td className="n">{horas(p.r.horasAyer)}</td>
                  <td className="n">{p.r.presuConTrab ? pct(p.r.trabConPresu / p.r.presuConTrab) : "–"}</td>
                  <td className="n">{p.r.excedidos || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="debil" style={{ marginTop: 10, fontSize: "0.82rem" }}>
          Todos los días son hábiles. <strong>Atrasados</strong>: SGR con la entrega estimada vencida. <strong>Atraso externo</strong>: días por espera del
          cliente (Aguardando retorno FPJ, pruebas UAT, cambios en el requerimiento) y pausas anteriores registradas; no dependen del equipo.{" "}
          {fz === "desa" && mostrarDev && <><strong>Devoluciones recibidas</strong>: veces que testing devolvió SGR de esta persona, por actualización de fuentes o
          errores encontrados. <strong>Atraso por devoluciones</strong>: días que esos SGR estuvieron frenados en testing esperando su corrección.{" "}</>}
          {fz === "test" && <><strong>Esperando corrección del desarrollador</strong>: días de atraso de SGR devueltos al desarrollador; no es demora del tester.{" "}</>}
          <strong>Pausa sin motivo</strong>: días en pausa sin indicar si se espera al cliente. <strong>Atraso por ejecución</strong>: atraso que no explican
          las causas anteriores. <strong>Horas usadas</strong>: horas trabajadas sobre presupuestadas, en SGR con presupuesto y horas cargadas.
          <strong> Excedidos</strong>: SGR con más horas trabajadas que presupuestadas.
          {fz === "desa" && !hayDesarrollador && <> Para atribuir las devoluciones de testing a cada desarrollador, la planilla de testing debe incluir la columna «Desarrollador».</>}
        </p>
      </section>

      {fz === "test" && <DevolucionesTesting items={sgr} />}

      {fz === "desa" && hayDesarrollador && (
        <section className="panel">
          <div className="panel-cab">
            <TituloRegion region="devoluciones_dev">Devoluciones de testing por desarrollador</TituloRegion>
            <p>SGR que hoy están en testing, según quién los desarrolló. Incluye desarrolladores del cliente.</p>
          </div>
          {devs.length === 0 ? <p className="debil">No hay SGR en testing para los filtros elegidos.</p> : (
            <div className="tabla-env">
              <table>
                <thead>
                  <tr><th>Desarrollador</th><th>Origen</th><th className="n">SGR en testing</th><th className="n">SGR con devoluciones</th>
                    <th className="n">Devoluciones</th><th className="n">Devueltos hoy</th><th className="n">Atraso por devoluciones</th></tr>
                </thead>
                <tbody>
                  {devs.map((d) => (
                    <tr key={d.clave}>
                      <td className="nombre">{d.nombre}</td>
                      <td><span className={`etiqueta ${d.externo ? "e-test" : "e-desa"}`}>{d.externo ? "Del cliente" : "Onnix"}</span></td>
                      <td className="n">{num(d.sgr)}</td>
                      <td className="n">{num(d.sgrConDevolucion)}</td>
                      <td className="n">{num(d.devoluciones)}</td>
                      <td className="n">{d.devueltosAhora || ""}</td>
                      <td className="n">{dias(d.atraso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="debil" style={{ marginTop: 10, fontSize: "0.82rem" }}>
            «Del cliente»: SGR sin importe de desarrollo, que desarrolló el equipo del cliente (por ejemplo DITA o DPJ). Atraso por devoluciones: días hábiles
            que el SGR estuvo frenado en testing esperando la corrección.
          </p>
        </section>
      )}

      <section className="panel">
        <div className="panel-cab">
          <TituloRegion region="detalle">Detalle de SGR</TituloRegion>
          <p>Primero los atrasados, del mayor al menor atraso.</p>
        </div>
        <TablaSgr items={ordenados} corte={corte} />
      </section>
    </>
  );
}

function DevolucionesTesting({ items }: { items: Analisis[] }) {
  const grupos = porDevolucionesTesting(items);
  const etiqueta = ETIQUETA_DEVOLUCIONES;
  return (
    <section className="panel">
      <div className="panel-cab">
        <TituloRegion region="devoluciones">Devoluciones al desarrollador</TituloRegion>
        <p>Cada devolución obliga a volver a probar: suma horas de testing y corre la fecha.</p>
      </div>
      <div className="tabla-env">
        <table>
          <thead><tr><th>Devoluciones</th><th className="n">SGR</th><th className="n">Con atraso</th><th className="n">Atraso mediano</th><th className="n">Horas de testing usadas</th></tr></thead>
          <tbody>
            {grupos.map((x) => (
              <tr key={x.g}>
                <td>{etiqueta[x.g]}</td><td className="n">{num(x.n)}</td><td className="n">{num(x.atrasados)}</td>
                <td className="n">{dias(x.atraso)}</td>
                <td className="n" style={{ color: x.consumo != null && x.consumo > 1 ? "var(--mal)" : undefined }}>{pct(x.consumo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
