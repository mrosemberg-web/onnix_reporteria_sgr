"use client";
import { useActionState, useState } from "react";
import { cambiarSecciones, claveTemporal, crearInvitacion, type EstadoInvitacion, type EstadoSecciones, type EstadoTemporal } from "./acciones";
import { SECCIONES } from "@/lib/secciones";

function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="enlace-copia">
      <input type="text" readOnly value={texto} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace" />
      <button type="button" className="boton sec" onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}>{copiado ? "Copiado" : "Copiar"}</button>
    </div>
  );
}

export function FormNuevaInvitacion() {
  const [estado, accion, pendiente] = useActionState<EstadoInvitacion, FormData>(crearInvitacion, {});
  const [rol, setRol] = useState("lector");
  return (
    <form action={accion} className="form" style={{ maxWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>Perfil
          <select name="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="lector">Consulta (solo reportes)</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label>Vence en
          <select name="dias" defaultValue="7">
            <option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="30">30 días</option>
          </select>
        </label>
      </div>
      <fieldset className="secciones-campo">
        <legend>Secciones a las que tendrá acceso</legend>
        {rol === "admin" ? <span className="debil">Los administradores ven todas las secciones.</span> : SECCIONES.map((s) => (
          <label key={s.clave}><input type="checkbox" name="secciones" value={s.clave} defaultChecked /> {s.nombre}</label>
        ))}
      </fieldset>
      <label>Para quién (opcional)<input type="text" name="nota" placeholder="Ej.: Gerencia de Operaciones del cliente" maxLength={120} /></label>
      <div><button className="boton" type="submit" disabled={pendiente}>Generar enlace de invitación</button></div>
      {estado.enlace && (
        <div className="aviso ok" role="status" style={{ display: "grid", gap: 8 }}>
          <span>Enlace generado. Copialo ahora: por seguridad no se vuelve a mostrar. Sirve para crear un solo usuario.</span>
          <Copiar texto={estado.enlace} />
        </div>
      )}
      {estado.error && <p className="aviso error">{estado.error}</p>}
    </form>
  );
}

export function BotonClaveTemporal({ id }: { id: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoTemporal, FormData>(claveTemporal, {});
  if (estado.clave) return <Copiar texto={estado.clave} />;
  return (
    <form action={accion} onSubmit={(e) => { if (!confirm("¿Generar una clave temporal? La clave actual deja de funcionar.")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pendiente}>Clave temporal</button>
      {estado.error && <span className="debil"> {estado.error}</span>}
    </form>
  );
}

/** Casillas de secciones de un usuario de consulta, con guardado en el lugar. */
export function EditorSecciones({ id, secciones }: { id: number; secciones: string[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoSecciones, FormData>(cambiarSecciones, {});
  return (
    <form action={accion} className="editor-secciones">
      <input type="hidden" name="id" value={id} />
      {SECCIONES.map((s) => (
        <label key={s.clave}><input type="checkbox" name="secciones" value={s.clave} defaultChecked={secciones.includes(s.clave)} /> {s.nombre}</label>
      ))}
      <button type="submit" disabled={pendiente}>Guardar</button>
      {estado.error && <span className="aviso error" style={{ padding: "2px 8px" }}>{estado.error}</span>}
      {estado.ok && <span className="debil">{estado.ok}</span>}
    </form>
  );
}
