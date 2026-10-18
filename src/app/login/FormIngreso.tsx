"use client";
import { useActionState } from "react";
import { ingresar, type EstadoForm } from "./acciones";

export function FormIngreso() {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(ingresar, {});
  return (
    <form action={accion} className="form">
      {estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      <label>
        Usuario
        <input key={`u${estado.intento ?? 0}`} type="text" name="usuario" autoComplete="username" required autoFocus={!estado.usuario} defaultValue={estado.usuario} />
      </label>
      <label>
        Clave
        <input type="password" name="clave" autoComplete="current-password" required autoFocus={!!estado.usuario} />
      </label>
      <button className="boton" type="submit" disabled={pendiente}>{pendiente ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
