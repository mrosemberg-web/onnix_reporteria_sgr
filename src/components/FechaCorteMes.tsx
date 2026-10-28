"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Fecha de corte del mes para la proyección: lo estimado para después de esta fecha,
 * dentro del mismo mes, pasa al mes siguiente. Se guarda en la URL (?hasta=AAAA-MM-DD).
 */
export function FechaCorteMes({ valor, min, max, porDefecto }: { valor: string; min: string; max: string; porDefecto: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [fecha, setFecha] = useState(valor);
  const [pendiente, iniciar] = useTransition();

  function aplicar(nueva: string | null) {
    const q = new URLSearchParams(sp.toString());
    if (nueva) q.set("hasta", nueva); else q.delete("hasta");
    iniciar(() => router.push(`${ruta}?${q.toString()}`));
  }

  return (
    <form className="corte-mes no-imprimir" aria-busy={pendiente}
      onSubmit={(e) => { e.preventDefault(); if (fecha) aplicar(fecha); }}>
      <label className="campo">
        Fecha de corte del mes
        <input type="date" value={fecha} min={min} max={max} required onChange={(e) => setFecha(e.target.value)} />
      </label>
      <button type="submit" className="boton" disabled={pendiente || fecha === valor}>Aplicar</button>
      {!porDefecto && <button type="button" className="boton sec" onClick={() => { aplicar(null); }}>Fin de mes</button>}
      <span className="debil">Lo estimado para después de esta fecha, dentro del mismo mes, pasa al mes siguiente.</span>
    </form>
  );
}
