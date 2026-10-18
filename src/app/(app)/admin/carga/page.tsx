import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fechaHora, num } from "@/lib/formato";
import { FormCarga } from "./FormCarga";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cargar planilla" };

export default async function Carga() {
  await requerirAdmin();
  const [[{ n }], historial] = await Promise.all([
    sql<{ n: number }[]>`select count(*) as n from requerimientos`,
    sql<{ id: number; archivo: string; filas: number; cargado_en: Date; nombre: string | null; adv: number }[]>`
      select c.id, c.archivo, c.filas, c.cargado_en, u.nombre, jsonb_array_length(c.advertencias) as adv
      from cargas c left join usuarios u on u.id = c.cargado_por order by c.id desc limit 15`,
  ]);
  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Cargar planilla</h1>
          <p>La planilla reemplaza todos los SGR cargados. La carga es atómica: si algo falla, los datos anteriores quedan como estaban.</p>
        </div>
      </header>
      <section className="panel"><FormCarga filasActuales={n} /></section>
      <section className="panel">
        <h2>Cargas anteriores</h2>
        {historial.length === 0 ? <p className="debil">Todavía no se cargó ninguna planilla.</p> : (
          <div className="tabla-env">
            <table>
              <thead><tr><th>Fecha</th><th>Archivo</th><th className="n">SGR</th><th className="n">Advertencias</th><th>Cargado por</th></tr></thead>
              <tbody>
                {historial.map((c, i) => (
                  <tr key={c.id}>
                    <td>{fechaHora(c.cargado_en)} {i === 0 && <span className="etiqueta e-bien">Vigente</span>}</td>
                    <td>{c.archivo}</td>
                    <td className="n">{num(c.filas)}</td>
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
