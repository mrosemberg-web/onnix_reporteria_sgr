"use client";
import { useActionState, useState } from "react";
import { agregarFeriado, type EstadoFeriado } from "./acciones";

export function FormFeriado() {
  const [estado, accion, pendiente] = useActionState<EstadoFeriado, FormData>(agregarFeriado, {});
  const [tipo, setTipo] = useState("fijo");
  return (
    <form action={accion} className="form" style={{ maxWidth: 640 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <label>Fecha no laborable<input type="date" name="fecha" required /></label>
        <label>Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="fijo">Fijo</option>
            <option value="trasladado">Trasladado</option>
            <option value="extraordinario">Extraordinario (decreto)</option>
          </select>
        </label>
        {tipo === "trasladado" && <label>Fecha que conmemora<input type="date" name="fecha_original" required /></label>}
      </div>
      <label>Motivo<input type="text" name="descripcion" maxLength={160} required placeholder="Ej.: Batalla de Boquerón (Decreto 6601)" /></label>
      <div><button className="boton" type="submit" disabled={pendiente}>Guardar feriado</button></div>
      {estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}
    </form>
  );
}
