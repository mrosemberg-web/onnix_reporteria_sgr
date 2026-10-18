"use client";
import { useActionState } from "react";
import { cambiarClave, type EstadoClave } from "./acciones";

export function FormClave() {
  const [estado, accion, pendiente] = useActionState<EstadoClave, FormData>(cambiarClave, {});
  return (
    <form action={accion} className="form">
      {estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}
      <label>Clave actual<input type="password" name="actual" autoComplete="current-password" required /></label>
      <label>Clave nueva<input type="password" name="nueva" autoComplete="new-password" required minLength={10} /></label>
      <label>Repetir clave nueva<input type="password" name="confirmar" autoComplete="new-password" required minLength={10} /></label>
      <button className="boton" type="submit" disabled={pendiente}>Cambiar clave</button>
    </form>
  );
}
