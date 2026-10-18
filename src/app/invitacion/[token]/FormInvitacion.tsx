"use client";
import { useActionState } from "react";
import { aceptarInvitacion, type EstadoInvitacion } from "./acciones";

export function FormInvitacion({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoInvitacion, FormData>(aceptarInvitacion, {});
  return (
    <form action={accion} className="form">
      {estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      <input type="hidden" name="token" value={token} />
      <label>Nombre y apellido<input key={`n${estado.intento ?? 0}`} type="text" name="nombre" autoComplete="name" required defaultValue={estado.nombre} /></label>
      <label>Usuario<input key={`u${estado.intento ?? 0}`} type="text" name="usuario" autoComplete="username" required pattern="[A-Za-z0-9._\-]{3,40}" defaultValue={estado.usuario} /></label>
      <label>Clave<input type="password" name="clave" autoComplete="new-password" required minLength={10} /></label>
      <label>Repetir clave<input type="password" name="confirmar" autoComplete="new-password" required minLength={10} /></label>
      <p className="debil" style={{ fontSize: "0.82rem" }}>La clave debe tener al menos 10 caracteres y combinar letras y números.</p>
      <button className="boton" type="submit" disabled={pendiente}>{pendiente ? "Creando usuario…" : "Crear usuario"}</button>
    </form>
  );
}
