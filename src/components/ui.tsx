import Link from "next/link";
import { FiltrosBar } from "./FiltrosBar";
import { num } from "@/lib/formato";
import type { Filtros } from "@/lib/filtros";
import type { opciones } from "@/lib/reportes";

export function Encabezado({ titulo, bajada, op, f }: {
  titulo: string; bajada?: React.ReactNode; op: Awaited<ReturnType<typeof opciones>>; f: Filtros;
}) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {bajada && <p>{bajada}</p>}
      </div>
      <FiltrosBar anios={op.anios} equipos={op.equipos} tipos={op.tipos} estados={op.estados} valores={f} />
    </header>
  );
}

export function Indicador({ nombre, valor, nota }: { nombre: string; valor: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <div className="indicador">
      <span className="nombre">{nombre}</span>
      <span className="valor">{valor}</span>
      {nota && <span className="nota">{nota}</span>}
    </div>
  );
}

/** Etiqueta según índice de cumplimiento (presupuestadas ÷ trabajadas). */
export function EtiquetaIndice({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="etiqueta e-neutro">Sin horas</span>;
  const cls = valor >= 1 ? "e-bien" : valor >= 1 / 1.1 ? "e-leve" : "e-mal";
  return <span className={`etiqueta ${cls}`}>{num(valor, 2)}</span>;
}

export function SinDatos({ esAdmin }: { esAdmin: boolean }) {
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <h2>Todavía no hay datos cargados</h2>
      <p style={{ marginTop: 10, color: "var(--tinta-2)" }}>
        Los reportes se arman a partir de la planilla de facturación por período.{" "}
        {esAdmin ? "Subila para empezar." : "Pedile a un administrador que la cargue."}
      </p>
      {esAdmin && <p style={{ marginTop: 16 }}><Link className="boton" href="/admin/carga">Cargar planilla</Link></p>}
    </div>
  );
}

export function Lectura({ parrafos, fase }: { parrafos: string[]; fase?: "desa" | "test" }) {
  if (!parrafos.length) return null;
  return (
    <section className={`lectura ${fase === "test" ? "test" : ""}`} aria-label="Lectura de los datos">
      <h2>Lectura</h2>
      {parrafos.map((p, i) => <p key={i}>{p}</p>)}
    </section>
  );
}
