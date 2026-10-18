"use client";
import { useMemo, useState } from "react";
import type { FilaDetalle } from "@/lib/reportes";
import { claseEstado, nombreEstado } from "@/lib/estados";

const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 1 });
const n = (v: number | null) => (v === null ? "–" : nf.format(v));
const f = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "–");

type Col = { k: keyof FilaDetalle; t: string; num?: boolean; fecha?: boolean };
const COLS: Col[] = [
  { k: "id_req", t: "SGR" }, { k: "asunto", t: "Asunto" }, { k: "estado", t: "Estado" }, { k: "tipo_requerimiento", t: "Tipo" },
  { k: "asignado_a", t: "Desarrollo" }, { k: "horas_desa", t: "H. desa", num: true }, { k: "horas_presu_desa", t: "Presu. desa", num: true },
  { k: "asignado_testing", t: "Testing" }, { k: "horas_test", t: "H. test", num: true }, { k: "horas_presu_test", t: "Presu. test", num: true },
  { k: "devoluciones", t: "Dev. al cliente", num: true }, { k: "horas_pausadas", t: "Pausa (h)", num: true },
  { k: "fecha_fin_desa", t: "Fin desa", fecha: true }, { k: "fecha_fin_testing", t: "Fin test", fecha: true },
  { k: "implementacion", t: "Implementación", fecha: true }, { k: "lead_neto", t: "Días netos", num: true },
];

function estadoFase(real: number, presu: number) {
  if (real === 0) return "e-neutro";
  if (real <= presu) return "e-bien";
  return real <= presu * 1.1 ? "e-leve" : "e-mal";
}

export function TablaRequerimientos({ filas }: { filas: FilaDetalle[] }) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ k: keyof FilaDetalle; asc: boolean }>({ k: "implementacion", asc: false });
  const [soloSobre, setSoloSobre] = useState(false);
  const [ocultarDesest, setOcultarDesest] = useState(false);

  const vista = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = filas.filter((x) =>
      !t || [x.id_req, x.asunto, x.asignado_a, x.asignado_testing, x.departamento, x.tipo_requerimiento]
        .some((v) => v?.toLowerCase().includes(t)));
    if (ocultarDesest) r = r.filter((x) => !x.desestimado);
    if (soloSobre) r = r.filter((x) => (x.aplica_desa && x.horas_desa > x.horas_presu_desa * 1.1) || (x.aplica_test && x.horas_test > x.horas_presu_test * 1.1));
    const k = orden.k;
    return [...r].sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = typeof va === "number" && typeof vb === "number" ? va - vb
        : k === "id_req" ? Number(va) - Number(vb) : String(va).localeCompare(String(vb), "es");
      return orden.asc ? c : -c;
    });
  }, [filas, q, orden, soloSobre, ocultarDesest]);

  return (
    <>
      <div className="filtros no-imprimir" style={{ marginBottom: 14 }}>
        <label className="campo">
          Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SGR, asunto, persona, área" style={{ minWidth: 260 }} />
        </label>
        <label className="campo" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem" }}>
          <input type="checkbox" checked={soloSobre} onChange={(e) => setSoloSobre(e.target.checked)} />
          Solo con desvío mayor a 10 %
        </label>
        <label className="campo" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem" }}>
          <input type="checkbox" checked={ocultarDesest} onChange={(e) => setOcultarDesest(e.target.checked)} />
          Ocultar desestimados
        </label>
        <span className="debil" style={{ fontSize: "0.85rem", alignSelf: "center" }}>{vista.length} de {filas.length} SGR</span>
      </div>
      <div className="tabla-env">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.k} className={c.num ? "n" : undefined}
                  aria-sort={orden.k === c.k ? (orden.asc ? "ascending" : "descending") : "none"}>
                  <button className="th-orden" onClick={() => setOrden((o) => ({ k: c.k, asc: o.k === c.k ? !o.asc : c.num ? false : true }))}>
                    {c.t}{orden.k === c.k ? (orden.asc ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.map((r) => (
              <tr key={r.id_req}>
                <td>{r.id_req}</td>
                <td className="recorte" title={r.asunto ?? ""}>{r.asunto}</td>
                <td><span className={`etiqueta ${claseEstado(r.estado)}`} title={r.estado ?? ""}>{nombreEstado(r.estado)}</span></td>
                <td className="recorte" style={{ maxWidth: 160 }} title={r.tipo_requerimiento ?? ""}>{r.tipo_requerimiento}</td>
                {r.aplica_desa ? (
                  <>
                    <td>{r.asignado_a ?? "–"}</td>
                    <td className="n"><span className={`etiqueta ${estadoFase(r.horas_desa, r.horas_presu_desa)}`}>{n(r.horas_desa)}</span></td>
                    <td className="n">{n(r.horas_presu_desa)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="debil" title={r.equipo_externo ? "Desarrollo a cargo del cliente (DITA/DPJ)" : "Sin fase de desarrollo"}>
                    {r.equipo_externo ? "Desarrollo del cliente" : "Sin desarrollo"}
                  </td>
                )}
                {r.aplica_test ? (
                  <>
                    <td>{r.asignado_testing ?? "–"}</td>
                    <td className="n"><span className={`etiqueta ${estadoFase(r.horas_test, r.horas_presu_test)}`}>{n(r.horas_test)}</span></td>
                    <td className="n">{n(r.horas_presu_test)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="debil">Sin testing</td>
                )}
                <td className="n">{r.devoluciones || ""}</td>
                <td className="n">{r.horas_pausadas ? n(r.horas_pausadas) : ""}</td>
                <td className="n">{r.aplica_desa ? f(r.fecha_fin_desa) : "–"}</td>
                <td className="n">{r.aplica_test ? f(r.fecha_fin_testing) : "–"}</td>
                <td className="n">{f(r.implementacion)}</td>
                <td className="n">{n(r.lead_neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
