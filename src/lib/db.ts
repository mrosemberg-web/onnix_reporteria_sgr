import "server-only";
import postgres from "postgres";


function crear() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  return postgres(url, {
    // El pooler de Supabase en modo transacción (puerto 6543) no admite prepared statements.
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    // Fallar rápido (y mostrar el motivo) en vez de dejar la pantalla esperando.
    connect_timeout: 8,
    max_lifetime: 60 * 10,
    onnotice: () => {},
    types: {
      // numeric y bigint como number; fechas como texto 'YYYY-MM-DD' para no correr el día por zona horaria.
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
}

type Sql = ReturnType<typeof crear>;
const g = globalThis as unknown as { __sql?: Sql };
export const sql: Sql = g.__sql ?? (g.__sql = crear());
