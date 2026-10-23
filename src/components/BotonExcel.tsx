"use client";
import { usePathname, useSearchParams } from "next/navigation";

/** Descarga en Excel una región de la pantalla (o todas, sin region), con los filtros actuales. */
export function BotonExcel({ region, texto }: { region?: string; texto?: string }) {
  const ruta = usePathname();
  const sp = useSearchParams();
  const q = new URLSearchParams(sp.toString());
  q.set("ruta", ruta);
  if (region) q.set("region", region);
  const etiqueta = texto ?? (region ? "Excel" : "Exportar todo a Excel");
  return (
    <a className={`boton sec no-imprimir ${region ? "boton-excel" : ""}`} href={`/api/excel?${q.toString()}`} download
      title={region ? "Descargar esta tabla en Excel" : "Descargar todas las tablas de esta pantalla en un Excel, una hoja por tabla"}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {etiqueta}
    </a>
  );
}

/** Título de una región con su botón de exportación. */
export function TituloRegion({ region, children }: { region: string; children: React.ReactNode }) {
  return (
    <div className="titulo-region">
      <h2>{children}</h2>
      <BotonExcel region={region} />
    </div>
  );
}
