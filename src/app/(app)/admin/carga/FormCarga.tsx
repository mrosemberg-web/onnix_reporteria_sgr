"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { detectarTipo, matrizCsv, NOMBRE_TIPO, type TipoPlanilla } from "@/lib/planilla-seguimiento";
import { cargarPlanillas, type EstadoCarga } from "./acciones";

type Elegido = { archivo: File; tipo: TipoPlanilla | null };

const REEMPLAZA: Record<TipoPlanilla, (n: Record<TipoPlanilla, number>) => string> = {
  facturacion: (n) => `reemplaza los ${n.facturacion} SGR históricos`,
  seguimiento_desa: (n) => `reemplaza los ${n.seguimiento_desa} registros en curso de desarrollo`,
  seguimiento_test: (n) => `reemplaza los ${n.seguimiento_test} registros en curso de testing`,
};
const DESTINO: Record<TipoPlanilla, string> = { facturacion: "/", seguimiento_desa: "/en-curso", seguimiento_test: "/en-curso" };

async function tipoDe(f: File): Promise<TipoPlanilla | null> {
  const bytes = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
  let txt: string;
  try { txt = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { txt = new TextDecoder("windows-1252").decode(bytes); }
  return detectarTipo(matrizCsv(txt.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "")[0] ?? []);
}

export function FormCarga({ actuales, hoy }: { actuales: Record<TipoPlanilla, number>; hoy: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCarga, FormData>(cargarPlanillas, { estado: "inicial" });
  const [elegidos, setElegidos] = useState<Elegido[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (estado.estado !== "inicial") setElegidos([]); }, [estado]);

  async function elegir(lista: FileList | null) {
    const files = Array.from(lista ?? []).slice(0, 3);
    setElegidos(await Promise.all(files.map(async (archivo) => ({ archivo, tipo: await tipoDe(archivo) }))));
  }

  function soltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    if (!e.dataTransfer.files?.length || !input.current) return;
    const dt = new DataTransfer();
    Array.from(e.dataTransfer.files).slice(0, 3).forEach((f) => dt.items.add(f));
    input.current.files = dt.files;
    elegir(dt.files);
  }

  const reconocidos = elegidos.filter((e) => e.tipo);
  const resultados = estado.estado === "listo" ? estado.resultados : [];

  return (
    <form action={accion} className="form" style={{ maxWidth: 720 }}>
      <div className={`zona-archivo ${arrastrando ? "activa" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={soltar}>
        <strong>Arrastrá hasta 3 planillas acá o elegilas</strong>
        <span className="debil" style={{ fontSize: "0.85rem" }}>
          CSV separado por punto y coma. El tipo se reconoce solo: Facturación por período, Seguimiento de desarrollo y Seguimiento de testing.
        </span>
        <input ref={input} type="file" name="archivos" accept=".csv,text/csv" multiple required onChange={(e) => elegir(e.target.files)} />
      </div>

      {elegidos.length > 0 && (
        <ul className="lista-archivos">
          {elegidos.map((e) => (
            <li key={e.archivo.name}>
              <span>{e.archivo.name}</span>
              {e.tipo
                ? <span className="etiqueta e-desa">{NOMBRE_TIPO[e.tipo]}</span>
                : <span className="etiqueta e-mal">No reconocida</span>}
              {e.tipo && <span className="debil">{REEMPLAZA[e.tipo](actuales)}</span>}
            </li>
          ))}
        </ul>
      )}

      <label style={{ maxWidth: 260 }}>
        Fecha de corte
        <input type="date" name="fecha_corte" defaultValue={hoy} max={hoy} required />
        <span className="debil" style={{ fontSize: "0.8rem" }}>El «hoy» con el que se calculan los atrasos de los SGR en curso.</span>
      </label>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--tinta)" }}>
        <input type="checkbox" name="confirmo" value="si" required style={{ width: "auto", marginTop: 4 }} />
        <span>Entiendo que cada planilla reemplaza todos los datos de su tipo.</span>
      </label>
      <div>
        <button className="boton" type="submit" disabled={pendiente || reconocidos.length === 0}>
          {pendiente ? "Cargando…" : reconocidos.length > 1 ? `Cargar ${reconocidos.length} planillas` : "Cargar planilla"}
        </button>
      </div>

      {estado.estado === "listo" && estado.error && <p className="aviso error" role="alert">{estado.error}</p>}
      {resultados.map((r) => (
        <div key={r.archivo} className={`aviso ${r.ok ? "ok" : "error"}`} role={r.ok ? "status" : "alert"}>
          <strong>{r.archivo}</strong>{r.tipo && <> ({NOMBRE_TIPO[r.tipo]})</>}:{" "}
          {r.ok ? <>cargada, {r.filas} filas. <Link href={DESTINO[r.tipo]}>Ver reportes</Link></> : "no se cargó. Los datos anteriores de este tipo siguen intactos."}
          {!r.ok && <ul className="lista-adv" style={{ color: "inherit" }}>{r.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {r.advertencias.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary>{r.advertencias.length} advertencias</summary>
              <ul className="lista-adv">{r.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </details>
          )}
        </div>
      ))}
    </form>
  );
}
