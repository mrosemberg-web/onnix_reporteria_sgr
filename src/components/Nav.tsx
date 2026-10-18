"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; texto: string; conFiltros?: boolean };

const REPORTES: Item[] = [
  { href: "/", texto: "Resumen", conFiltros: true },
  { href: "/desarrollo", texto: "Desarrollo", conFiltros: true },
  { href: "/testing", texto: "Testing", conFiltros: true },
  { href: "/tiempos", texto: "Tiempos y devoluciones", conFiltros: true },
  { href: "/desglose", texto: "Por área y tipo", conFiltros: true },
  { href: "/facturacion", texto: "Facturación", conFiltros: true },
  { href: "/requerimientos", texto: "Requerimientos", conFiltros: true },
];
const ADMIN: Item[] = [
  { href: "/admin/carga", texto: "Cargar planilla" },
  { href: "/admin/usuarios", texto: "Usuarios" },
];

export function Nav({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const sp = useSearchParams();
  // Conserva año y filtros al moverse entre reportes.
  const q = new URLSearchParams();
  for (const k of ["anio", "equipo", "tipo", "estado"]) {
    const v = sp.get(k);
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  const enlace = (i: Item) => (
    <Link key={i.href} href={i.conFiltros && qs ? `${i.href}?${qs}` : i.href} aria-current={ruta === i.href ? "page" : undefined}>
      {i.texto}
    </Link>
  );
  return (
    <nav className="nav" aria-label="Secciones">
      <span className="nav-grupo">Reportes</span>
      {REPORTES.map(enlace)}
      {esAdmin && (
        <>
          <span className="nav-grupo">Administración</span>
          {ADMIN.map(enlace)}
        </>
      )}
    </nav>
  );
}
