"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SelectorMultiple, type Opcion } from "./SelectorMultiple";

export type DefFiltro = { param: string; etiqueta: string; opciones: Opcion[]; seleccion: string[] };

/** Barra de filtros genérica: cada filtro admite varios valores y se guarda en la URL. */
export function FiltrosLista({ filtros }: { filtros: DefFiltro[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  function aplicar(param: string, vals: string[]) {
    const q = new URLSearchParams(sp.toString());
    q.delete(param);
    for (const v of vals) q.append(param, v);
    iniciar(() => router.push(`${ruta}?${q.toString()}`));
  }

  return (
    <div className="filtros no-imprimir" aria-busy={pendiente}>
      {filtros.map((f) => (
        <SelectorMultiple key={f.param} etiqueta={f.etiqueta} opciones={f.opciones} seleccion={f.seleccion}
          onAplicar={(v) => aplicar(f.param, v)} />
      ))}
    </div>
  );
}
