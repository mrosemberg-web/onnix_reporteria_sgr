import { requerirAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fechaHora } from "@/lib/formato";
import { cambiarActivo, cambiarRol, revocarInvitacion } from "./acciones";
import { BotonClaveTemporal, FormNuevaInvitacion } from "./Cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios" };

export default async function Usuarios() {
  const s = await requerirAdmin();
  const [usuarios, invitaciones] = await Promise.all([
    sql<{ id: number; usuario: string; nombre: string; rol: string; activo: boolean; ultimo_acceso: Date | null; bloqueado: boolean }[]>`
      select id, usuario, nombre, rol, activo, ultimo_acceso, coalesce(bloqueado_hasta > now(), false) as bloqueado
      from usuarios order by activo desc, nombre`,
    sql<{ id: number; rol: string; nota: string | null; creada_en: Date; expira_en: Date; creador: string | null }[]>`
      select i.id, i.rol, i.nota, i.creada_en, i.expira_en, u.nombre as creador
      from invitaciones i left join usuarios u on u.id = i.creada_por
      where i.usada_en is null and not i.revocada and i.expira_en > now() order by i.creada_en desc`,
  ]);

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Usuarios</h1>
          <p>Las personas se suman con un enlace de invitación: eligen su usuario y clave. Cada enlace sirve una sola vez.</p>
        </div>
      </header>

      <section className="panel">
        <h2>Invitar a una persona</h2>
        <FormNuevaInvitacion />
      </section>

      {invitaciones.length > 0 && (
        <section className="panel">
          <h2>Invitaciones pendientes</h2>
          <div className="tabla-env">
            <table>
              <thead><tr><th>Para</th><th>Perfil</th><th>Creada</th><th>Vence</th><th>Creada por</th><th /></tr></thead>
              <tbody>
                {invitaciones.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nota ?? <span className="debil">Sin nota</span>}</td>
                    <td>{i.rol === "admin" ? "Administrador" : "Consulta"}</td>
                    <td>{fechaHora(i.creada_en)}</td>
                    <td>{fechaHora(i.expira_en)}</td>
                    <td>{i.creador ?? "–"}</td>
                    <td className="acciones-fila">
                      <form action={revocarInvitacion}><input type="hidden" name="id" value={i.id} /><button type="submit">Revocar</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Usuarios</h2>
        <div className="tabla-env">
          <table>
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.map((u) => {
                const yo = u.id === s.uid;
                return (
                  <tr key={u.id}>
                    <td>{u.nombre}{yo && <span className="debil"> (vos)</span>}</td>
                    <td>{u.usuario}</td>
                    <td>{u.rol === "admin" ? "Administrador" : "Consulta"}</td>
                    <td>
                      {!u.activo ? <span className="etiqueta e-neutro">Inactivo</span>
                        : u.bloqueado ? <span className="etiqueta e-leve">Bloqueado 15 min</span>
                        : <span className="etiqueta e-bien">Activo</span>}
                    </td>
                    <td>{fechaHora(u.ultimo_acceso)}</td>
                    <td>
                      {!yo && (
                        <div className="acciones-fila">
                          <form action={cambiarRol}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="rol" value={u.rol === "admin" ? "lector" : "admin"} />
                            <button type="submit">{u.rol === "admin" ? "Pasar a consulta" : "Hacer administrador"}</button>
                          </form>
                          <form action={cambiarActivo}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="activo" value={u.activo ? "no" : "si"} />
                            <button type="submit">{u.activo ? "Desactivar" : "Activar"}</button>
                          </form>
                          {u.activo && <BotonClaveTemporal id={u.id} />}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
