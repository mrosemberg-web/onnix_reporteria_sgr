import { BotonExcel } from "@/components/BotonExcel";
import { LineaTiempo } from "@/components/graficos";
import { ChipEtapa, ChipSituacion, EncabezadoSeguimiento, SinSeguimiento } from "@/components/seguimiento-ui";
import { Buscador } from "@/components/Buscador";
import { requerirSeccion } from "@/lib/auth";
import { textoBusqueda } from "@/lib/busqueda";
import { cargarHoras, type HorasPersona } from "@/lib/horas";
import type { SearchParams } from "@/lib/filtros";
import { fecha, horas, num } from "@/lib/formato";
import { aplicarFiltros, cargarSeguimiento, leerFiltrosSeguimiento, opcionesSeguimiento } from "@/lib/seguimiento";
import { CAUSAS, type Analisis } from "@/lib/seguimiento-calculo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tablero del equipo" };

const ORDEN = { atrasado: 0, vence_pronto: 1, en_plazo: 2, replanificacion: 3, sin_plan: 4, fin_tarde: 5, fin_a_tiempo: 6, sin_asignacion: 7 };
const FASE = { desa: "Desarrollo", test: "Testing" } as const;

export default async function Tablero({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sesion = await requerirSeccion("en_curso");
  const [{ analisis, cargas, corte }, sp] = await Promise.all([cargarSeguimiento(), searchParams]);
  const hp = await cargarHoras(analisis);
  const horasDe = new Map(hp.personas.map((p) => [p.usuario, p]));
  if (!analisis.length) return <SinSeguimiento esAdmin={sesion.rol === "admin"} />;
  const f = leerFiltrosSeguimiento(sp);
  const op = opcionesSeguimiento(analisis);
  const items = aplicarFiltros(analisis, f);

  return (
    <>
      <EncabezadoSeguimiento titulo="Tablero del equipo" op={op} f={f} cargas={cargas}
        bajada="Lo que tiene cada persona, ordenado por urgencia. Pensado para repasar en la reunión de equipo." />
      <div className="no-imprimir"><BotonExcel region="tablero" texto="Excel del tablero" /></div>
      <Buscador>
      <div className="tablero">
        {(["desa", "test"] as const).map((fz) => {
          const deFase = items.filter((a) => a.fase === fz);
          if (!deFase.length) return null;
          const lideres = [...new Set(deFase.map((a) => a.lider))].sort();
          return lideres.map((l) => {
            const delLider = deFase.filter((a) => a.lider === l);
            const personas = [...new Set(delLider.map((a) => a.usuario))];
            return (
              <section key={`${fz}-${l}`} className="tablero-lider" data-busqueda-grupo="">
                <h2>{FASE[fz]}: {l === "Sin líder" ? "sin líder asignado" : `equipo de ${op.nombres.get(l) ?? l}`}</h2>
                <div className="tarjetas">
                  {personas.map((u) => <Tarjeta key={u} items={delLider.filter((a) => a.usuario === u)} corte={corte[fz]} horasMes={horasDe.get(u)} periodo={hp.nombrePeriodo} />)}
                </div>
              </section>
            );
          });
        })}
      </div>
      </Buscador>
    </>
  );
}

function Tarjeta({ items, corte, horasMes, periodo }: { items: Analisis[]; corte: string; horasMes?: HorasPersona; periodo: string }) {
  const p = items[0];
  const sgr = items.filter((a) => a.etapa !== "sin_asignacion")
    .sort((a, b) => ORDEN[a.situacion] - ORDEN[b.situacion] || (b.atraso ?? 0) - (a.atraso ?? 0));
  const atrasados = sgr.filter((a) => a.situacion === "atrasado").length;
  return (
    <article className="tarjeta" data-busqueda-grupo="">
      <div className="tarjeta-cab">
        <strong>{p.nombre ?? p.usuario}</strong>
        <span>{num(sgr.length)} SGR{atrasados ? `, ${atrasados} atrasados` : ""}{horasMes
          ? `; ${periodo}: ${horas(horasMes.trabajadas ?? 0)} de ${horas(horasMes.potencial)}` : ""}</span>
      </div>
      {sgr.length === 0 ? <p className="debil" data-busqueda={textoBusqueda(p.nombre, p.usuario, p.lider)}>Sin SGR asignado.</p> : (
        <ul>
          {sgr.map((a) => (
            <li key={a.id_req} data-busqueda={textoBusqueda(a.id_req, a.asunto, p.nombre, p.usuario, a.lider, a.estado, a.tipo_servicio, a.equipo)}>
              <span className="sgr">{a.id_req}</span>
              <span className="asunto" title={a.asunto ?? ""}>{a.asunto}</span>
              <span className="meta">
                <ChipSituacion a={a} />
                <ChipEtapa a={a} />
                {a.entrega_estimada && <LineaTiempo inicio={a.fecha_inicio} estimada={a.entrega_estimada} nueva={a.entregaCorregida} corte={corte}
                  fin={a.etapa === "finalizado" ? a.fecha_estado : null} />}
                <span className="debil">
                  {a.entrega_estimada ? `Entrega ${fecha(a.entregaCorregida ?? a.entrega_estimada)}` : "Sin fecha"}
                  {a.situacion === "atrasado" && a.causaPrincipal && <>; {CAUSAS[a.causaPrincipal].nombre.toLowerCase()}</>}
                  {a.fase === "test" && (a.devoluciones ?? 0) > 0 && <>; {a.devoluciones} devoluciones</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
