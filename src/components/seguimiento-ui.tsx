import { BotonPdf } from "./BotonPdf";
import { FiltrosLista } from "./FiltrosLista";
import { LineaTiempo } from "./graficos";
import { fecha, fechaHora, horas, num, pct } from "@/lib/formato";
import type { CargaSeguimiento, FiltrosSeguimiento } from "@/lib/seguimiento";
import {
  CAUSAS, ETAPAS, EJECUCION, ORDEN_CAUSAS, ORDEN_ETAPAS, SITUACIONES, type Analisis, type Causa,
} from "@/lib/seguimiento-calculo";

export function EncabezadoSeguimiento({ titulo, bajada, f, op, cargas, mostrarFase = true }: {
  titulo: string; bajada?: React.ReactNode; f: FiltrosSeguimiento;
  op: { lideres: string[]; personas: string[]; nombres: Map<string, string>; servicios: string[] };
  cargas: CargaSeguimiento[]; mostrarFase?: boolean;
}) {
  const filtros = [
    ...(mostrarFase ? [{ param: "fase", etiqueta: "Fase", seleccion: f.fases,
      opciones: [{ valor: "desa", texto: "Desarrollo" }, { valor: "test", texto: "Testing" }] }] : []),
    { param: "lider", etiqueta: "Líder", seleccion: f.lideres, opciones: op.lideres.map((l) => ({ valor: l, texto: op.nombres.get(l) ?? l })) },
    { param: "persona", etiqueta: "Persona", seleccion: f.personas, opciones: op.personas.map((p) => ({ valor: p, texto: op.nombres.get(p) ?? p })) },
    { param: "tservicio", etiqueta: "Tipo de servicio", seleccion: f.servicios, opciones: op.servicios.map((s) => ({ valor: s, texto: s })) },
    { param: "etapa", etiqueta: "Etapa", seleccion: f.etapas, opciones: ORDEN_ETAPAS.map((e) => ({ valor: e, texto: ETAPAS[e].nombre })) },
    { param: "situacion", etiqueta: "Situación", seleccion: f.situaciones,
      opciones: (["atrasado", "vence_pronto", "en_plazo", "replanificacion", "sin_plan", "fin_tarde", "fin_a_tiempo"] as const).map((s) => ({ valor: s, texto: SITUACIONES[s].nombre })) },
  ];
  const cortes = cargas.map((c) => `${c.tipo === "seguimiento_desa" ? "desarrollo" : "testing"} al ${fecha(c.fecha_corte)} («${c.archivo}»)`).join("; ");
  return (
    <header className="encabezado">
      <div className="encabezado-texto">
        <p className="solo-impresion impresion-marca">Productividad del servicio de desarrollo y testing</p>
        <div className="encabezado-titulo">
          <h1>{titulo}</h1>
          <BotonPdf nombreArchivo={`${titulo} - En curso`} />
        </div>
        {bajada && <p>{bajada}</p>}
        <p className="debil" style={{ fontSize: "0.85rem", marginTop: 4 }}>
          {cortes ? `Corte: ${cortes}.` : "Todavía no se cargaron planillas de seguimiento."}
        </p>
        <p className="solo-impresion impresion-meta">Generado el {fechaHora(new Date())}.</p>
      </div>
      <FiltrosLista filtros={filtros} />
    </header>
  );
}

export function ChipEtapa({ a }: { a: Analisis }) {
  return <span className={`etiqueta ${ETAPAS[a.etapa].clase}`} title={a.estado ?? ""}>{ETAPAS[a.etapa].nombre}</span>;
}

export function ChipSituacion({ a }: { a: Analisis }) {
  const s = SITUACIONES[a.situacion];
  return <span className={`etiqueta ${s.clase}`}>{s.nombre}{a.atraso ? ` ${num(a.atraso)} d` : ""}</span>;
}

/** Mini barra con la composición del atraso de un SGR por causa. */
export function ComposicionAtraso({ a }: { a: Analisis }) {
  if (!a.atraso) return <span className="debil">–</span>;
  const W = 120;
  let x = 0;
  const partes = ORDEN_CAUSAS.filter((c) => a.causas[c] > 0);
  const titulo = partes.map((c) => `${CAUSAS[c].nombre}: ${a.causas[c]} d`).join(", ")
    + (a.ejecucion ? `. Ejecución: ${EJECUCION[a.ejecucion].nombre.toLowerCase()}` : "");
  return (
    <span className="composicion" title={titulo}>
      <svg width={W} height={10} viewBox={`0 0 ${W} 10`} aria-hidden="true">
        {partes.map((c) => {
          const w = (a.causas[c] / a.atraso!) * W;
          const r = <rect key={c} x={x} y={0} width={w} height={10} fill={CAUSAS[c].color} />;
          x += w;
          return r;
        })}
      </svg>
      <span>{a.causaPrincipal ? CAUSAS[a.causaPrincipal].nombre : ""}</span>
    </span>
  );
}

export function LeyendaCausas({ causas = ORDEN_CAUSAS }: { causas?: Causa[] }) {
  return (
    <dl className="leyenda-causas">
      {causas.map((c) => (
        <div key={c}>
          <dt><i style={{ background: CAUSAS[c].color }} />{CAUSAS[c].nombre}</dt>
          <dd>{CAUSAS[c].ayuda}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SinSeguimiento({ esAdmin }: { esAdmin: boolean }) {
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <h2>Todavía no hay datos de requerimientos en curso</h2>
      <p style={{ marginTop: 10, color: "var(--tinta-2)" }}>
        Este apartado se arma con las planillas de seguimiento de desarrollo y de testing.{" "}
        {esAdmin ? <a href="/admin/carga">Subilas en Cargar planillas.</a> : "Pedile a un administrador que las cargue."}
      </p>
    </div>
  );
}

export function TablaSgr({ items, corte, conPersona = true }: { items: Analisis[]; corte: { desa: string; test: string }; conPersona?: boolean }) {
  return (
    <div className="tabla-env">
      <table>
        <thead>
          <tr>
            <th>SGR</th><th>Asunto</th>{conPersona && <th>Responsable</th>}<th>Etapa</th><th className="n">Días hábiles en estado</th>
            <th>Entrega estimada</th><th>Plan y atraso</th><th className="n">Atraso (hábiles)</th><th>Causa principal</th>
            <th className="n">Horas</th><th className="n">Consumo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={`${a.fase}-${a.id_req}-${a.usuario}`}>
              <td>{a.id_req}{a.fase === "test" && (a.devoluciones ?? 0) > 0 && <span className="debil" title="Devoluciones al desarrollador"> ({a.devoluciones} dev.)</span>}</td>
              <td className="recorte" title={a.asunto ?? ""}>{a.asunto}</td>
              {conPersona && <td>{a.nombre ?? a.usuario}</td>}
              <td><ChipEtapa a={a} /></td>
              <td className="n">{num(a.diasEnEstado)}{a.pausaSinRegistrar > 1 && (
                <span className="etiqueta e-leve" style={{ marginLeft: 6 }} title={`${a.pausaSinRegistrar} días hábiles detenido sin horas pausadas registradas`}>Revisar pausa</span>)}</td>
              <td>{fecha(a.entrega_estimada)}{a.entregaCorregida && a.entregaCorregida !== a.entrega_estimada && <span className="debil" title="Corrida por pausas, en días hábiles"> → {fecha(a.entregaCorregida)}</span>}</td>
              <td><LineaTiempo inicio={a.fecha_inicio} estimada={a.entrega_estimada} nueva={a.entregaCorregida} corte={corte[a.fase]}
                fin={a.etapa === "finalizado" ? a.fecha_estado : null} /></td>
              <td className="n">{a.atraso ? `${num(a.atraso)} d` : a.situacion === "sin_plan" ? "–" : "0"}</td>
              <td><ComposicionAtraso a={a} /></td>
              <td className="n">{horas(a.horas_trab)}{a.horas_presu != null && <span className="debil"> / {horas(a.horas_presu)}</span>}</td>
              <td className="n" style={{ color: a.consumo != null && a.consumo > 1 ? "var(--mal)" : undefined }}>{pct(a.consumo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
