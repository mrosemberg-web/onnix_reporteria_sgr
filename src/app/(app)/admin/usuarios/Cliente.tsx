"use client";
import { useActionState, useState } from "react";
import { claveTemporal, crearInvitacion, type EstadoInvitacion, type EstadoTemporal } from "./acciones";

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
  return (
    <form action={accion} className="form" style={{ maxWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>Perfil
          <select name="rol" defaultValue="lector">
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
