import { TituloRegion } from "@/components/BotonExcel";
import { Encabezado, EtiquetaIndice, Indicador, Lectura, SinDatos } from "@/components/ui";
import { contextoReporte } from "@/lib/contexto";
import { textoAnios, type SearchParams } from "@/lib/filtros";
import { fecha, gs, gsCorto, horas, num } from "@/lib/formato";
import { facturacion, fase, indice } from "@/lib/reportes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facturación" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { sesion, op, f, vacio } = await contextoReporte(searchParams);
  if (vacio) return <SinDatos esAdmin={sesion.rol === "admin"} />;
  const [periodos, d, t] = await Promise.all([facturacion(f), fase("desa", f), fase("test", f)]);
  const total = periodos.reduce((s, p) => s + p.total, 0);
  const pendientes = periodos.find((p) => p.periodo === null);
  const exced = d.total.horas_excedidas + t.total.horas_excedidas;
  const ahorr = d.total.horas_ahorradas + t.total.horas_ahorradas;
  const factDesest = periodos.reduce((s, p) => s + p.total_desestimados, 0);
  const nDesest = periodos.reduce((s, p) => s + p.desestimados, 0);
  const totDesa = periodos.reduce((s, p) => s + p.importe_desa, 0);
  const totTest = periodos.reduce((s, p) => s + p.importe_test, 0);
  const totTestCliente = periodos.reduce((s, p) => s + p.importe_test_cliente, 0);

  const lectura = [
    `La facturación se calcula sobre horas presupuestadas, no sobre horas trabajadas.`,
    `En los SGR que superaron su presupuesto se trabajaron ${horas(exced)} más de lo presupuestado, que no se facturaron. En los que terminaron por debajo, se usaron ${horas(ahorr)} menos.`,
  ];

  return (
    <>
      <Encabezado titulo={`Facturación ${textoAnios(f)}`} op={op} f={f}
        bajada="SGR implementados en el año, agrupados por fecha de facturación. Las horas facturadas son las presupuestadas de cada fase." />
      <section className="banda">
        <Indicador nombre="Total facturado" valor={gsCorto(total)} nota={`${num(periodos.reduce((s, p) => s + p.sgr, 0))} SGR`} />
        <Indicador nombre="Desarrollo" valor={gsCorto(totDesa)} nota="SGR con presupuesto de desarrollo" />
        <Indicador nombre="Testing (servicio adicional)" valor={gsCorto(totTest)} nota={`${gsCorto(totTestCliente)} sobre desarrollos del cliente`} />
        <Indicador nombre="Sin fecha de facturación" valor={gsCorto(pendientes?.total ?? 0)} nota={`${num(pendientes?.sgr ?? 0)} SGR`} />
        <Indicador nombre="Horas trabajadas no facturadas" valor={horas(exced)} nota="excedente sobre lo presupuestado" />
        <Indicador nombre="Horas presupuestadas no usadas" valor={horas(ahorr)} nota="SGR terminados por debajo" />
        <Indicador nombre="De SGR desestimados" valor={gsCorto(factDesest)} nota={`${num(nDesest)} SGR que el cliente desestimó con trabajo ya hecho`} />
      </section>
      <Lectura parrafos={lectura} />
      <section className="panel">
        <TituloRegion region="periodos">Por período de facturación</TituloRegion>
        <div className="tabla-env">
          <table>
            <thead>
              <tr><th>Fecha de facturación</th><th className="n">SGR</th><th className="n">Desestimados</th><th className="n">Desarrollo</th><th className="n">Testing</th>
                <th className="n">Total</th><th className="n">Horas facturadas</th><th className="n">Horas trabajadas</th><th className="n">Índice</th></tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p.periodo ?? "pendiente"}>
                  <td>{p.periodo ? fecha(p.periodo) : <span className="etiqueta e-leve">Sin fecha</span>}</td>
                  <td className="n">{num(p.sgr)}</td>
                  <td className="n">{p.desestimados ? num(p.desestimados) : ""}</td>
                  <td className="n">{gs(p.importe_desa)}</td>
                  <td className="n">{gs(p.importe_test)}</td>
                  <td className="n">{gs(p.total)}</td>
                  <td className="n">{horas(p.horas_presu)}</td>
                  <td className="n">{horas(p.horas_real)}</td>
                  <td className="n"><EtiquetaIndice valor={indice(p)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="n">{num(periodos.reduce((s, p) => s + p.sgr, 0))}</td>
                <td className="n">{num(nDesest)}</td>
                <td className="n">{gs(totDesa)}</td>
                <td className="n">{gs(totTest)}</td>
                <td className="n">{gs(total)}</td>
                <td className="n">{horas(periodos.reduce((s, p) => s + p.horas_presu, 0))}</td>
                <td className="n">{horas(periodos.reduce((s, p) => s + p.horas_real, 0))}</td>
                <td className="n"><EtiquetaIndice valor={indice({
                  presu_reg: periodos.reduce((s, p) => s + p.presu_reg, 0), real_reg: periodos.reduce((s, p) => s + p.real_reg, 0) })} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="debil" style={{ marginTop: 12, fontSize: "0.82rem" }}>
          La columna Desarrollo solo suma SGR con horas presupuestadas de desarrollo; Testing incluye el servicio sobre desarrollos de Onnix y del cliente. El total respeta el «Total a facturar» de la planilla.
        </p>
      </section>
    </>
  );
}
