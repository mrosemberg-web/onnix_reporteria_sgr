"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; texto: string; claves?: readonly string[] };

const HISTORICO = ["anio", "equipo", "tipo", "estado", "servicio"] as const;
const EN_CURSO = ["fase", "lider", "persona", "tservicio", "etapa", "situacion"] as const;

const REPORTES: Item[] = [
  { href: "/", texto: "Resumen", claves: HISTORICO },
  { href: "/desarrollo", texto: "Desarrollo", claves: HISTORICO },
  { href: "/testing", texto: "Testing", claves: HISTORICO },
  { href: "/tiempos", texto: "Tiempos y devoluciones", claves: HISTORICO },
  { href: "/desglose", texto: "Por área y tipo", claves: HISTORICO },
  { href: "/facturacion", texto: "Facturación", claves: HISTORICO },
  { href: "/requerimientos", texto: "Requerimientos", claves: HISTORICO },
];
const CURSO: Item[] = [
  { href: "/en-curso", texto: "Resumen en curso", claves: EN_CURSO },
  { href: "/en-curso/desarrollo", texto: "Desarrollo en curso", claves: EN_CURSO },
  { href: "/en-curso/testing", texto: "Testing en curso", claves: EN_CURSO },
  { href: "/en-curso/equipo", texto: "Tablero del equipo", claves: EN_CURSO },
];
const ADMIN: Item[] = [
  { href: "/admin/carga", texto: "Cargar planillas" },
  { href: "/admin/usuarios", texto: "Usuarios" },
];

export function Nav({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const sp = useSearchParams();
  // Conserva los filtros al moverse entre pantallas de la misma sección.
  const enlace = (i: Item) => {
    const q = new URLSearchParams();
    for (const k of i.claves ?? []) for (const v of sp.getAll(k)) q.append(k, v);
    const qs = q.toString();
    return (
      <Link key={i.href} href={qs ? `${i.href}?${qs}` : i.href} aria-current={ruta === i.href ? "page" : undefined}>
        {i.texto}
      </Link>
    );
  };
  return (
    <nav className="nav" aria-label="Secciones">
      <span className="nav-grupo">Implementados</span>
      {REPORTES.map(enlace)}
      <span className="nav-grupo">En curso</span>
      {CURSO.map(enlace)}
      {esAdmin && (
        <>
          <span className="nav-grupo">Administración</span>
          {ADMIN.map(enlace)}
        </>
      )}
    </nav>
  );
}
