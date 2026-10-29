import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { lunesCercanos } from "@/lib/feriados";
import { fecha } from "@/lib/formato";
import { deshacerTraslado, eliminarFeriado } from "./acciones";
import { FormPrecarga, TrasladoMovil } from "./Cliente";
import { FormFeriado } from "./FormFeriado";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feriados" };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const TIPO = { fijo: "Fijo", trasladado: "Trasladado", extraordinario: "Extraordinario" } as Record<string, string>;

export default async function Feriados() {
  await requerirAdmin();
  const filas = await sql<{ fecha: string; descripcion: string; tipo: string; fecha_original: string | null; movil: boolean }[]>`
    select fecha, descripcion, tipo, fecha_original, movil from feriados order by fecha desc`;
  const anios = [...new Set(filas.map((f) => f.fecha.slice(0, 4)))];
  const actual = new Date().getFullYear();
  const sugerido = [actual, actual + 1, actual + 2].find((a) => !anios.includes(String(a))) ?? actual + 1;
  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Feriados</h1>
          <p>
            Todos los plazos se cuentan en días hábiles: de lunes a viernes, sin los feriados de esta lista. Cada año se precarga con
            sus fechas legales; cuando el Poder Ejecutivo decreta el traslado de un feriado móvil, se traslada desde la tabla, y los
            feriados extraordinarios se agregan a mano. Los cambios se aplican al instante en todos los reportes.
          </p>
        </div>
      </header>
      <div className="rejilla-2">
        <section className="panel">
          <h2>Precargar un año</h2>
          <FormPrecarga sugerido={sugerido} />
        </section>
        <section className="panel">
          <h2>Agregar feriado extraordinario u otro</h2>
          <FormFeriado />
        </section>
      </div>
      {anios.map((a) => {
        const delAnio = filas.filter((f) => f.fecha.startsWith(a));
        const pendientes = delAnio.filter((f) => f.movil && f.tipo !== "trasladado" && lunesCercanos(f.fecha)).length;
        return (
          <section className="panel" key={a}>
            <div className="panel-cab">
              <h2>{a}: {delAnio.length} feriados, {delAnio.filter((f) => ![0, 6].includes(new Date(`${f.fecha}T00:00:00Z`).getUTCDay())).length} en día hábil</h2>
              {pendientes > 0 && <p>{pendientes} {pendientes === 1 ? "feriado móvil sigue" : "feriados móviles siguen"} en su fecha legal.</p>}
            </div>
            <div className="tabla-env">
              <table>
                <thead><tr><th>Fecha</th><th>Día</th><th>Motivo</th><th>Tipo</th><th>Conmemora</th><th>Traslado</th><th /></tr></thead>
                <tbody>
                  {delAnio.map((f) => {
                    const dow = new Date(`${f.fecha}T00:00:00Z`).getUTCDay();
                    const lunes = f.movil && f.tipo !== "trasladado" ? lunesCercanos(f.fecha) : null;
                    return (
                      <tr key={f.fecha}>
                        <td className="nombre">{fecha(f.fecha)}</td>
                        <td>{DIAS[dow]}{(dow === 0 || dow === 6) && <span className="debil"> (no afecta)</span>}</td>
                        <td>{f.descripcion}{f.movil && <span className="etiqueta e-neutro" style={{ marginLeft: 6 }}>Móvil</span>}</td>
                        <td><span className={`etiqueta ${f.tipo === "fijo" ? "e-neutro" : f.tipo === "trasladado" ? "e-desa" : "e-test"}`}>{TIPO[f.tipo] ?? f.tipo}</span></td>
                        <td>{f.fecha_original ? fecha(f.fecha_original) : ""}</td>
                        <td>
                          {lunes && <TrasladoMovil fecha={f.fecha} anterior={lunes.anterior} siguiente={lunes.siguiente} />}
                          {f.movil && f.tipo !== "trasladado" && !lunes && <span className="debil">Ya cae lunes</span>}
                          {f.tipo === "trasladado" && f.fecha_original && (
                            <form action={deshacerTraslado} className="acciones-fila">
                              <input type="hidden" name="fecha" value={f.fecha} />
                              <button type="submit">Volver al {fecha(f.fecha_original)}</button>
                            </form>
                          )}
                        </td>
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
