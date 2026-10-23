import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { generarLibro } from "@/lib/excel/libro";
import { paginaExcel } from "@/lib/excel/regiones";
import { desdeUrl } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Exporta a Excel una región (?region=…) o todas las regiones de una pantalla.
 * ?ruta= es la pantalla; el resto de los parámetros son sus filtros.
 */
export async function GET(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const ruta = params.get("ruta") ?? "/";
  const region = params.get("region");
  params.delete("ruta");
  params.delete("region");

  const pagina = await paginaExcel(ruta, desdeUrl(params));
  if (!pagina) return NextResponse.json({ error: "Pantalla sin exportación" }, { status: 404 });
  const defs = region ? pagina.regiones.filter((r) => r.id === region) : pagina.regiones;
  if (!defs.length) return NextResponse.json({ error: "Región desconocida" }, { status: 404 });

  const regiones = (await Promise.all(defs.map(async (d) => (await d.construir()).map((r) => ({ ...r, hoja: r.hoja ?? d.titulo }))))).flat();
  const buffer = await generarLibro(pagina, regiones, `${sesion.nombre} (${sesion.usuario})`);
  const nombre = `${pagina.titulo}${region ? ` - ${defs[0].titulo}` : ""}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
