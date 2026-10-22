import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fecha } from "@/lib/formato";
import { eliminarFeriado } from "./acciones";
import { FormFeriado } from "./FormFeriado";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feriados" };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const TIPO = { fijo: "Fijo", trasladado: "Trasladado", extraordinario: "Extraordinario" } as Record<string, string>;

export default async function Feriados() {
  await requerirAdmin();
  const filas = await sql<{ fecha: string; descripcion: string; tipo: string; fecha_original: string | null }[]>`
    select fecha, descripcion, tipo, fecha_original from feriados order by fecha desc`;
  const anios = [...new Set(filas.map((f) => f.fecha.slice(0, 4)))];
  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Feriados</h1>
          <p>
            Todos los plazos se cuentan en días hábiles: de lunes a viernes, sin los feriados de esta lista. Cargá la fecha en que
            efectivamente no se trabaja; si un feriado se trasladó, cargá el día trasladado. Los cambios se aplican al instante en
            todos los reportes.
          </p>
        </div>
      </header>
      <section className="panel">
        <h2>Agregar feriado</h2>
        <FormFeriado />
      </section>
      {anios.map((a) => {
        const delAnio = filas.filter((f) => f.fecha.startsWith(a));
        return (
          <section className="panel" key={a}>
            <h2>{a}: {delAnio.length} feriados, {delAnio.filter((f) => ![0, 6].includes(new Date(`${f.fecha}T00:00:00Z`).getUTCDay())).length} en día hábil</h2>
            <div className="tabla-env">
              <table>
                <thead><tr><th>Fecha</th><th>Día</th><th>Motivo</th><th>Tipo</th><th>Conmemora</th><th /></tr></thead>
                <tbody>
                  {delAnio.map((f) => {
                    const dow = new Date(`${f.fecha}T00:00:00Z`).getUTCDay();
                    return (
                      <tr key={f.fecha}>
                        <td>{fecha(f.fecha)}</td>
                        <td>{DIAS[dow]}{(dow === 0 || dow === 6) && <span className="debil"> (no afecta)</span>}</td>
                        <td>{f.descripcion}</td>
                        <td><span className={`etiqueta ${f.tipo === "fijo" ? "e-neutro" : f.tipo === "trasladado" ? "e-desa" : "e-test"}`}>{TIPO[f.tipo] ?? f.tipo}</span></td>
                        <td>{f.fecha_original ? fecha(f.fecha_original) : ""}</td>
                        <td className="acciones-fila">
                          <form action={eliminarFeriado}><input type="hidden" name="fecha" value={f.fecha} /><button type="submit">Quitar</button></form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
