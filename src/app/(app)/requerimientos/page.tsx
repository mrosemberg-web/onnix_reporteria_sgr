import { TablaRequerimientos } from "@/components/TablaRequerimientos";
import { Encabezado, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import { aQuery, textoAnios, type SearchParams } from "@/lib/filtros";
import { detalle } from "@/lib/reportes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requerimientos" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const filas = await detalle(f);
  return (
    <>
      <Encabezado titulo={`Requerimientos ${textoAnios(f)}`} op={op} f={f}
        bajada="Detalle por SGR con las reglas aplicadas. El color de las horas indica si la fase quedó dentro del presupuesto." />
      <section className="panel">
        <div className="panel-cab" style={{ marginBottom: 12 }}>
          <h2>Detalle de SGR</h2>
          <a className="boton sec no-imprimir" href={`/api/exportar?${aQuery(f)}`}>Descargar CSV</a>
        </div>
        <TablaRequerimientos filas={filas} />
      </section>
    </>
  );
}
