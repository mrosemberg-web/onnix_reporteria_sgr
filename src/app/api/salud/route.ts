import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { describirError } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de configuración, accesible sin sesión: abrí /api/salud en el navegador.
 * No devuelve secretos ni la cadena de conexión, solo si cada pieza está bien.
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  let destino: Record<string, unknown> = { definida: Boolean(url) };
  try {
    const u = new URL(url);
    destino = {
      definida: true,
      es_pooler_supabase: u.hostname.endsWith("pooler.supabase.com"),
      puerto: u.port || "5432",
      usuario_con_ref: u.username.startsWith("postgres."),
      clave_de_ejemplo: /YOUR-PASSWORD|\[|\]/i.test(decodeURIComponent(u.password)),
    };
  } catch {
    if (url) destino = { definida: true, formato_valido: false };
  }

  const authSecret = (process.env.AUTH_SECRET ?? "").length >= 32;

  let base: Record<string, unknown>;
  const t0 = Date.now();
  try {
    const [r] = await sql<{ usuarios: number; admins: number; requerimientos: number }[]>`
      select (select count(*) from usuarios) as usuarios,
             (select count(*) from usuarios where rol = 'admin' and activo) as admins,
             (select count(*) from requerimientos) as requerimientos`;
    const [v] = await sql<{ vista_estados: boolean }[]>`
      select exists (select 1 from information_schema.columns
                     where table_name = 'v_requerimientos' and column_name = 'desestimado') as vista_estados`;
    base = { conecta: true, ms: Date.now() - t0, ...r, migracion_estados: v.vista_estados };
  } catch (e) {
    const d = describirError(e);
    base = { conecta: false, ms: Date.now() - t0, codigo: d.codigo, motivo: d.mensaje };
  }

  const ok = authSecret && base.conecta === true && Number(base.admins ?? 0) > 0;
  return NextResponse.json(
    { ok, auth_secret_valido: authSecret, database_url: destino, base, region: process.env.VERCEL_REGION ?? null },
    { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
