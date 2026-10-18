import Link from "next/link";
import { BarraLibro } from "@/components/graficos";
import { Encabezado, EtiquetaIndice, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import { aQuery, type SearchParams } from "@/lib/filtros";
import { dias, gs, horas, num, pct } from "@/lib/formato";
import { desglose, indice, type Dimension } from "@/lib/reportes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Por área y tipo" };

const DIMS: { clave: Dimension; texto: string; singular: string }[] = [
  { clave: "tipo_requerimiento", texto: "Tipo de requerimiento", singular: "Tipo" },
  { clave: "departamento", texto: "Departamento", singular: "Departamento" },
  { clave: "equipo", texto: "Equipo", singular: "Equipo" },
  { clave: "solicitante", texto: "Solicitante", singular: "Solicitante" },
];

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { sesion, op, f, vacio } = await contextoReporte(Promise.resolve(sp));
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const dim = DIMS.find((d) => d.clave === sp.por) ?? DIMS[0];
  const filas = await desglose(dim.clave, f);
  const totalFact = filas.reduce((s, r) => s + r.facturado, 0);
  const max = Math.max(1, ...filas.map((r) => Math.max(r.horas_real, r.horas_presu)));

  return (
    <>
      <Encabezado titulo={`Por área y tipo ${f.anio}`} op={op} f={f}
        bajada="Dónde se concentra el trabajo y cómo rinde el presupuesto en cada segmento. Las horas suman desarrollo y testing con las reglas de cada equipo." />
      <nav className="acciones-fila no-imprimir" aria-label="Agrupar por">
        {DIMS.map((d) => (
          <Link key={d.clave} href={`/desglose?${aQuery(f)}&por=${d.clave}`}
            className={`etiqueta ${d.clave === dim.clave ? "e-desa" : "e-neutro"}`} style={{ padding: "6px 12px", textDecoration: "none" }}
            aria-current={d.clave === dim.clave ? "page" : undefined}>
            {d.texto}
          </Link>
        ))}
      </nav>
      <section className="panel">
        <h2>{dim.texto}</h2>
        <div className="tabla-env">
          <table>
            <thead>
              <tr>
                <th>{dim.singular}</th><th className="n">SGR entregados</th><th className="n">Trabajadas</th><th className="n">Presupuestadas</th>
                <th aria-label="Comparación gráfica" /><th className="n">Índice</th><th className="n">Facturado</th>
                <th className="n">Parte del total</th><th className="n">Devueltos al cliente</th><th className="n">Entrega mediana</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.clave}>
                  <td>{r.clave}</td>
                  <td className="n">{num(r.entregados)}{r.desestimados > 0 && <span className="debil" title="Desestimados por el cliente"> +{r.desestimados} desest.</span>}</td>
                  <td className="n">{horas(r.horas_real)}</td>
                  <td className="n">{horas(r.horas_presu)}</td>
                  <td><BarraLibro real={r.horas_real} presu={r.horas_presu} max={max} color="var(--desa)" /></td>
                  <td className="n"><EtiquetaIndice valor={indice(r)} /></td>
                  <td className="n">{gs(r.facturado)}</td>
                  <td className="n">{pct(totalFact ? r.facturado / totalFact : 0, 1)}</td>
                  <td className="n">{num(r.sgr_con_devolucion)} <span className="debil">({pct(r.sgr ? r.sgr_con_devolucion / r.sgr : 0)})</span></td>
                  <td className="n">{dias(r.lead_neto_med)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
