"use client";
import { useActionState } from "react";
import { precargarAnio, trasladarFeriado, type EstadoFeriado } from "./acciones";

const dm = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);

export function FormPrecarga({ sugerido }: { sugerido: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFeriado, FormData>(precargarAnio, {});
  return (
    <form action={accion} className="form" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ maxWidth: 140 }}>Año<input type="number" name="anio" min={2020} max={2100} defaultValue={sugerido} required /></label>
        <button className="boton" type="submit" disabled={pendiente}>Precargar año</button>
      </div>
      <p className="debil" style={{ fontSize: "0.82rem" }}>
        Carga los feriados de la Ley 7544 en su fecha legal: los fijos, Semana Santa calculada para ese año y los móviles
        (1/3, 12/6, 20/6 y 29/9). No modifica los que ya estén cargados ni vuelve a crear los que ya se trasladaron.
      </p>
      {estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}
    </form>
  );
}

/** Botones para trasladar un feriado móvil al lunes anterior o siguiente, con el número de decreto. */
export function TrasladoMovil({ fecha, anterior, siguiente }: { fecha: string; anterior: string; siguiente: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFeriado, FormData>(trasladarFeriado, {});
  return (
    <form action={accion} className="traslado">
      <input type="hidden" name="fecha" value={fecha} />
      <input type="text" name="decreto" placeholder="N.º de decreto" aria-label="Número de decreto" maxLength={40} />
      <button type="submit" name="destino" value="anterior" disabled={pendiente}>Al lunes {dm(anterior)}</button>
      <button type="submit" name="destino" value="siguiente" disabled={pendiente}>Al lunes {dm(siguiente)}</button>
      {estado.error && <span className="aviso error" style={{ padding: "2px 8px" }}>{estado.error}</span>}
    </form>
  );
}
