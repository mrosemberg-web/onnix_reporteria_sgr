"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { nombreEstado } from "@/lib/estados";
import { EQUIPO_EXTERNOS, EQUIPO_PROPIOS, type Filtros } from "@/lib/filtros";
import { nombreServicio } from "@/lib/servicios";
import { SelectorMultiple } from "./SelectorMultiple";

type Props = {
  anios: number[];
  equipos: string[];
  tipos: string[];
  estados: string[];
  servicios: string[];
  valores: Filtros;
};

export function FiltrosBar({ anios, equipos, tipos, estados, servicios, valores }: Props) {
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
      <SelectorMultiple etiqueta="Año de implementación" todosMarcaTodo
        opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))}
        seleccion={valores.anios.map(String)} onAplicar={(v) => aplicar("anio", v)} />
      <SelectorMultiple etiqueta="Servicio"
        opciones={servicios.map((s) => ({ valor: s, texto: nombreServicio(s) }))}
        seleccion={valores.servicios} onAplicar={(v) => aplicar("servicio", v)} />
      <SelectorMultiple etiqueta="Equipo"
        opciones={[
          { valor: EQUIPO_PROPIOS, texto: "Todos los equipos de Onnix", grupo: "Grupos" },
          { valor: EQUIPO_EXTERNOS, texto: "Equipos DITA y DPJ (desarrollo del cliente)", grupo: "Grupos" },
          ...equipos.map((v) => ({ valor: v, texto: v, grupo: "Equipos" })),
        ]}
        seleccion={valores.equipos} onAplicar={(v) => aplicar("equipo", v)} />
      <SelectorMultiple etiqueta="Tipo"
        opciones={tipos.map((v) => ({ valor: v, texto: v }))}
        seleccion={valores.tipos} onAplicar={(v) => aplicar("tipo", v)} />
      <SelectorMultiple etiqueta="Estado"
        opciones={estados.map((v) => ({ valor: v, texto: nombreEstado(v) }))}
        seleccion={valores.estados} onAplicar={(v) => aplicar("estado", v)} />
    </div>
  );
}
