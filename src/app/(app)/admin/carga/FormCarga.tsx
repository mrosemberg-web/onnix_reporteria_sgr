"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { cargarPlanilla, type EstadoCarga } from "./acciones";

export function FormCarga({ filasActuales }: { filasActuales: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoCarga, FormData>(cargarPlanilla, { estado: "inicial" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // React reinicia el formulario al terminar la acción: el archivo elegido se descarta.
  useEffect(() => { if (estado.estado !== "inicial") setArchivo(null); }, [estado]);

  function soltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files?.[0];
    if (f && input.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      input.current.files = dt.files;
      setArchivo(f);
    }
  }

  return (
    <form action={accion} className="form" style={{ maxWidth: 640 }}>
      <div className={`zona-archivo ${arrastrando ? "activa" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)} onDrop={soltar}>
        <strong>{archivo ? archivo.name : "Arrastrá la planilla acá o elegila"}</strong>
        <span className="debil" style={{ fontSize: "0.85rem" }}>
          {archivo ? `${(archivo.size / 1024).toFixed(0)} KB` : "CSV separado por punto y coma, como lo exporta el sistema (Facturación por período)."}
        </span>
        <input ref={input} type="file" name="archivo" accept=".csv,text/csv" required onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--tinta)" }}>
        <input type="checkbox" name="confirmo" value="si" required style={{ width: "auto", marginTop: 4 }} />
        <span>Entiendo que se van a reemplazar los {filasActuales} SGR cargados por el contenido de esta planilla.</span>
      </label>
      <div>
        <button className="boton" type="submit" disabled={pendiente || !archivo}>{pendiente ? "Cargando planilla…" : "Reemplazar datos"}</button>
      </div>

      {estado.estado === "ok" && (
        <div className="aviso ok" role="status">
          Planilla cargada: {estado.filas} SGR. <Link href="/">Ver el resumen</Link>
        </div>
      )}
      {estado.estado === "error" && (
        <div className="aviso error" role="alert">
          <strong>No se cargó la planilla. Los datos anteriores siguen intactos.</strong>
          <ul className="lista-adv" style={{ color: "inherit" }}>{estado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {estado.estado !== "inicial" && estado.advertencias.length > 0 && (
        <div className="aviso info">
          <strong>{estado.advertencias.length} advertencias</strong>
          <ul className="lista-adv">{estado.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
    </form>
  );
}
