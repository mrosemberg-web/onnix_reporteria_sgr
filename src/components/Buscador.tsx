"use client";
import { useEffect, useRef, useState } from "react";
import { normalizar } from "@/lib/busqueda";

/**
 * Buscador para listas renderizadas en el servidor: filtra los elementos con
 * data-busqueda (todas las palabras deben aparecer) y oculta los contenedores
 * data-busqueda-grupo que quedan sin elementos visibles.
 */
export function Buscador({ children, placeholder = "SGR, asunto, persona, área", unidad = "SGR" }: {
  children: React.ReactNode; placeholder?: string; unidad?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [conteo, setConteo] = useState<[number, number] | null>(null);

  useEffect(() => {
    const raiz = caja.current;
    if (!raiz) return;
    const palabras = normalizar(q).split(/\s+/).filter(Boolean);
    const filas = Array.from(raiz.querySelectorAll<HTMLElement>("[data-busqueda]"));
    let visibles = 0;
    for (const el of filas) {
      const ok = palabras.every((p) => (el.dataset.busqueda ?? "").includes(p));
      el.hidden = !ok;
      if (ok) visibles++;
    }
    // Grupos (tarjetas, secciones): de adentro hacia afuera.
    const grupos = Array.from(raiz.querySelectorAll<HTMLElement>("[data-busqueda-grupo]")).reverse();
    for (const g of grupos) {
      g.hidden = palabras.length > 0 && !Array.from(g.querySelectorAll<HTMLElement>("[data-busqueda]")).some((e) => !e.hidden);
    }
    setConteo([visibles, filas.length]);
  }, [q, children]);

  return (
    <>
      <div className="buscador no-imprimir">
        <label className="campo">
          Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        </label>
        {conteo && <span className="debil">{q ? `${conteo[0]} de ${conteo[1]} ${unidad}` : `${conteo[1]} ${unidad}`}</span>}
      </div>
      <div ref={caja}>{children}</div>
    </>
  );
}
