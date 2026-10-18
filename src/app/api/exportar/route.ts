import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { leerFiltros } from "@/lib/filtros";
import { detalle, opciones } from "@/lib/reportes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLUMNAS = [
  "id_req", "asunto", "departamento", "tipo_requerimiento", "equipo", "estado", "aplica_desa", "aplica_test",
  "asignado_a", "horas_desa", "horas_presu_desa", "horas_pausadas_desa", "asignado_testing", "horas_test",
  "horas_presu_test", "horas_pausadas_test", "devoluciones", "horas_pausadas", "fecha_inicio_desa", "fecha_fin_desa",
  "fecha_inicio_testing", "fecha_fin_testing", "implementacion", "fecha_facturacion", "total_facturar", "lead_cal", "lead_neto",
] as const;

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "SI" : "NO";
  if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!(await obtenerSesion())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const op = await opciones();
  const f = leerFiltros(Object.fromEntries(req.nextUrl.searchParams), op.anios);
  const filas = await detalle(f);
  const lineas = [COLUMNAS.join(";"), ...filas.map((r) => COLUMNAS.map((c) => celda(r[c])).join(";"))];
  return new NextResponse("\uFEFF" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="requerimientos_${f.anio}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
