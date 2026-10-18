"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { nombreEstado } from "@/lib/estados";

type Props = {
  anios: number[];
  equipos: string[];
  tipos: string[];
  estados: string[];
  valores: { anio: number; equipo: string; tipo: string; estado: string };
};

export function FiltrosBar({ anios, equipos, tipos, estados, valores }: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  function cambiar(clave: string, valor: string) {
    const q = new URLSearchParams(sp.toString());
    if (valor) q.set(clave, valor);
    else q.delete(clave);
    iniciar(() => router.push(`${ruta}?${q.toString()}`));
  }

  return (
    <div className="filtros no-imprimir" aria-busy={pendiente}>
      <label className="campo">
        Año de implementación
        <select value={valores.anio} onChange={(e) => cambiar("anio", e.target.value)}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="campo">
        Equipo
        <select value={valores.equipo} onChange={(e) => cambiar("equipo", e.target.value)}>
          <option value="">Todos</option>
          <option value="__propios">Equipos de Onnix</option>
          <option value="__externos">Solo testing (DITA y DPJ)</option>
          {equipos.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="campo">
        Tipo
        <select value={valores.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
          <option value="">Todos</option>
          {tipos.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="campo">
        Estado
        <select value={valores.estado} onChange={(e) => cambiar("estado", e.target.value)}>
          <option value="">Todos</option>
          {estados.map((v) => <option key={v} value={v}>{nombreEstado(v)}</option>)}
        </select>
      </label>
    </div>
  );
}
