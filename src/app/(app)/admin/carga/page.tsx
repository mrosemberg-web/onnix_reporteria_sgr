import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fecha, fechaHora, num } from "@/lib/formato";
import { NOMBRE_TIPO, type TipoPlanilla } from "@/lib/planilla-seguimiento";
import { FormCarga } from "./FormCarga";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cargar planillas" };

export default async function Carga() {
  await requerirAdmin();
  const [[conteo], historial] = await Promise.all([
    sql<{ facturacion: number; seguimiento_desa: number; seguimiento_test: number }[]>`
      select (select count(*) from requerimientos) as facturacion,
             (select count(*) from seguimiento where fase = 'desa') as seguimiento_desa,
             (select count(*) from seguimiento where fase = 'test') as seguimiento_test`,
    sql<{ id: number; tipo: TipoPlanilla; archivo: string; filas: number; cargado_en: Date; fecha_corte: string | null; nombre: string | null; adv: number; vigente: boolean }[]>`
      select c.id, c.tipo, c.archivo, c.filas, c.cargado_en, c.fecha_corte, u.nombre, jsonb_array_length(c.advertencias) as adv,
             c.id = max(c.id) over (partition by c.tipo) as vigente
      from cargas c left join usuarios u on u.id = c.cargado_por order by c.id desc limit 20`,
  ]);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "America/Asuncion" }).format(new Date());
  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Cargar planillas</h1>
          <p>
            Hay tres planillas: la de facturación por período (requerimientos implementados) y las dos de seguimiento de requerimientos
            en curso, desde la mirada de desarrollo y de testing. Cada una reemplaza solo los datos de su tipo y la carga es atómica:
            si algo falla, quedan los datos anteriores.
          </p>
        </div>
      </header>
      <section className="panel"><FormCarga actuales={conteo} hoy={hoy} /></section>
      <section className="panel">
        <h2>Cargas anteriores</h2>
        {historial.length === 0 ? <p className="debil">Todavía no se cargó ninguna planilla.</p> : (
          <div className="tabla-env">
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th className="n">Filas</th><th>Corte</th><th className="n">Advertencias</th><th>Cargado por</th></tr></thead>
              <tbody>
                {historial.map((c) => (
                  <tr key={c.id}>
                    <td>{fechaHora(c.cargado_en)} {c.vigente && <span className="etiqueta e-bien">Vigente</span>}</td>
                    <td>{NOMBRE_TIPO[c.tipo] ?? c.tipo}</td>
                    <td>{c.archivo}</td>
                    <td className="n">{num(c.filas)}</td>
                    <td>{fecha(c.fecha_corte)}</td>
                    <td className="n">{num(c.adv)}</td>
                    <td>{c.nombre ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
