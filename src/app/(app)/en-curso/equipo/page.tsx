import { LineaTiempo } from "@/components/graficos";
import { ChipEtapa, ChipSituacion, EncabezadoSeguimiento, SinSeguimiento } from "@/components/seguimiento-ui";
import { requerirSesion } from "@/lib/auth";
import type { SearchParams } from "@/lib/filtros";
import { fecha, horas, num } from "@/lib/formato";
import { aplicarFiltros, cargarSeguimiento, leerFiltrosSeguimiento, opcionesSeguimiento } from "@/lib/seguimiento";
import { CAUSAS, type Analisis } from "@/lib/seguimiento-calculo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tablero del equipo" };

const ORDEN = { atrasado: 0, vence_pronto: 1, en_plazo: 2, replanificacion: 3, sin_plan: 4, fin_tarde: 5, fin_a_tiempo: 6, sin_asignacion: 7 };
const FASE = { desa: "Desarrollo", test: "Testing" } as const;

export default async function Tablero({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sesion = await requerirSesion();
  const [{ analisis, cargas, corte }, sp] = await Promise.all([cargarSeguimiento(), searchParams]);
  if (!analisis.length) return <SinSeguimiento esAdmin={sesion.rol === "admin"} />;
  const f = leerFiltrosSeguimiento(sp);
  const op = opcionesSeguimiento(analisis);
  const items = aplicarFiltros(analisis, f);

  return (
    <>
      <EncabezadoSeguimiento titulo="Tablero del equipo" op={op} f={f} cargas={cargas}
        bajada="Lo que tiene cada persona, ordenado por urgencia. Pensado para repasar en la reunión de equipo." />
      <div className="tablero">
        {(["desa", "test"] as const).map((fz) => {
          const deFase = items.filter((a) => a.fase === fz);
          if (!deFase.length) return null;
          const lideres = [...new Set(deFase.map((a) => a.lider))].sort();
          return lideres.map((l) => {
            const delLider = deFase.filter((a) => a.lider === l);
            const personas = [...new Set(delLider.map((a) => a.usuario))];
            return (
              <section key={`${fz}-${l}`} className="tablero-lider">
                <h2>{FASE[fz]}: {l === "Sin líder" ? "sin líder asignado" : `equipo de ${op.nombres.get(l) ?? l}`}</h2>
                <div className="tarjetas">
                  {personas.map((u) => <Tarjeta key={u} items={delLider.filter((a) => a.usuario === u)} corte={corte[fz]} />)}
                </div>
              </section>
            );
          });
        })}
      </div>
    </>
  );
}

function Tarjeta({ items, corte }: { items: Analisis[]; corte: string }) {
  const p = items[0];
  const sgr = items.filter((a) => a.etapa !== "sin_asignacion")
    .sort((a, b) => ORDEN[a.situacion] - ORDEN[b.situacion] || (b.atraso ?? 0) - (a.atraso ?? 0));
  const ayer = items.reduce((s, a) => s + a.horas_ayer, 0);
  const atrasados = sgr.filter((a) => a.situacion === "atrasado").length;
  return (
    <article className="tarjeta">
      <div className="tarjeta-cab">
        <strong>{p.nombre ?? p.usuario}</strong>
        <span>{num(sgr.length)} SGR{atrasados ? `, ${atrasados} atrasados` : ""}; ayer {horas(ayer)}</span>
      </div>
      {sgr.length === 0 ? <p className="debil">Sin SGR asignado.</p> : (
        <ul>
          {sgr.map((a) => (
            <li key={a.id_req}>
              <span className="sgr">{a.id_req}</span>
              <span className="asunto" title={a.asunto ?? ""}>{a.asunto}</span>
              <span className="meta">
                <ChipSituacion a={a} />
                <ChipEtapa a={a} />
                {a.entrega_estimada && <LineaTiempo inicio={a.fecha_inicio} estimada={a.entrega_estimada} nueva={a.nueva_entrega} corte={corte}
                  fin={a.etapa === "finalizado" ? a.fecha_estado : null} />}
                <span className="debil">
                  {a.entrega_estimada ? `Entrega ${fecha(a.nueva_entrega ?? a.entrega_estimada)}` : "Sin fecha"}
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
