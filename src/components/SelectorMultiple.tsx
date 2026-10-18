"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Opcion = { valor: string; texto: string; grupo?: string };

type Props = {
  etiqueta: string;
  opciones: Opcion[];
  seleccion: string[];
  onAplicar: (valores: string[]) => void;
  /** Texto cuando no hay nada elegido (sin filtro). */
  textoVacio?: string;
  /** El botón "Todos" marca todas las opciones (en lugar de limpiar el filtro). */
  todosMarcaTodo?: boolean;
};

/** Lista desplegable con casillas: permite elegir varios valores y se aplica al cerrar. */
export function SelectorMultiple({ etiqueta, opciones, seleccion, onAplicar, textoVacio = "Todos", todosMarcaTodo = false }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(seleccion);
  const [busqueda, setBusqueda] = useState("");
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => { if (!abierto) setElegidos(seleccion); }, [seleccion, abierto]);

  const cambio = elegidos.length !== seleccion.length || elegidos.some((v) => !seleccion.includes(v));

  function cerrar(aplicar = true) {
    setAbierto(false);
    setBusqueda("");
    if (aplicar && cambio) onAplicar(elegidos);
  }

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) cerrar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  });

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? opciones.filter((o) => o.texto.toLowerCase().includes(q)) : opciones;
  }, [opciones, busqueda]);

  const resumen = (() => {
    const actual = abierto ? elegidos : seleccion;
    if (!actual.length) return textoVacio;
    if (todosMarcaTodo && actual.length === opciones.length && opciones.length > 1) return "Todos";
    if (actual.length === 1) return opciones.find((o) => o.valor === actual[0])?.texto ?? actual[0];
    if (actual.length <= 3 && actual.every((v) => v.length <= 6)) return actual.join(", ");
    return `${actual.length} seleccionados`;
  })();

  const alternar = (v: string) => setElegidos((e) => (e.includes(v) ? e.filter((x) => x !== v) : [...e, v]));
  let grupoAnterior: string | undefined;

  return (
    <div className="campo selector" ref={caja}>
      <span id={`${id}-et`}>{etiqueta}</span>
      <button type="button" className={`selector-boton ${seleccion.length ? "activo" : ""}`}
        aria-haspopup="true" aria-expanded={abierto} aria-labelledby={`${id}-et ${id}-val`}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}>
        <span id={`${id}-val`} className="selector-valor">{resumen}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {abierto && (
        <div className="selector-panel" role="group" aria-label={etiqueta}>
          {opciones.length > 8 && (
            <input type="search" className="selector-busqueda" placeholder="Buscar" value={busqueda} autoFocus
              onChange={(e) => setBusqueda(e.target.value)} aria-label={`Buscar en ${etiqueta}`} />
          )}
          <div className="selector-atajos">
            <button type="button" onClick={() => setElegidos(todosMarcaTodo ? opciones.map((o) => o.valor) : [])}>Todos</button>
            {!todosMarcaTodo && elegidos.length > 0 && <span className="debil">{elegidos.length} elegidos</span>}
          </div>
          <div className="selector-lista">
            {visibles.map((o) => {
              const cabecera = o.grupo && o.grupo !== grupoAnterior ? o.grupo : null;
              grupoAnterior = o.grupo;
              return (
                <div key={o.valor}>
                  {cabecera && <div className="selector-grupo">{cabecera}</div>}
                  <label className="selector-opcion">
                    <input type="checkbox" checked={elegidos.includes(o.valor)} onChange={() => alternar(o.valor)} />
                    <span>{o.texto}</span>
                  </label>
                </div>
              );
            })}
            {!visibles.length && <p className="debil" style={{ padding: "6px 8px" }}>Sin coincidencias</p>}
          </div>
          <div className="selector-pie">
            <button type="button" className="boton sec" onClick={() => cerrar(false)}>Cancelar</button>
            <button type="button" className="boton" onClick={() => cerrar()} disabled={!cambio}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}
