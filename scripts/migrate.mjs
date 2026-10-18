// Aplica en orden los archivos de supabase/migrations que todavía no se ejecutaron.
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { requireEnv } from "./_env.mjs";

const sql = postgres(requireEnv("DATABASE_URL"), { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migraciones (archivo text primary key, aplicada_en timestamptz not null default now())`;
  await sql`alter table schema_migraciones enable row level security`;
  const hechas = new Set((await sql`select archivo from schema_migraciones`).map((r) => r.archivo));
  const archivos = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const f of archivos) {
    if (hechas.has(f)) continue;
    const contenido = readFileSync(`supabase/migrations/${f}`, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(contenido);
      await tx`insert into schema_migraciones (archivo) values (${f})`;
    });
    console.log(`Aplicada: ${f}`);
  }
  console.log("Base de datos al día.");
} catch (e) {
  console.error("Error al migrar:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
