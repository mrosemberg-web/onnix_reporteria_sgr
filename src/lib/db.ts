import "server-only";
import postgres from "postgres";
import { waitUntil } from "@vercel/functions";

/**
 * Conexión a PostgreSQL pensada para Vercel (Fluid compute) + pooler de Supabase.
 *
 * Problema conocido: Vercel congela la función entre requests. Mientras está
 * congelada, el pooler cierra las conexiones inactivas, pero postgres.js no se
 * entera (sus temporizadores no corren) y, al reanudar, escribe en un socket
 * muerto: la consulta queda colgada hasta el límite de la función (504).
 *
 * Defensa en dos capas:
 *  1. Tras cada uso, se mantiene viva la función (waitUntil) hasta que vence
 *     idle_timeout, así postgres.js cierra sus conexiones antes de congelarse.
 *  2. Antes de atender un request, si el cliente estuvo inactivo, se verifica
 *     con un SELECT 1 con tiempo límite; si no responde, se recrea el cliente.
 */

const INACTIVIDAD_S = 5;          // postgres.js cierra conexiones ociosas tras 5 s
const VERIFICAR_SI_INACTIVO_MS = 2000;
const LIMITE_VERIFICACION_MS = 3000;

function crear() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  return postgres(url, {
    // El pooler de Supabase en modo transacción (puerto 6543) no admite prepared statements.
    prepare: false,
    // Sin pipelining: detrás de un pooler en modo transacción (Supavisor), una segunda
    // consulta enviada por el mismo socket antes de recibir la respuesta de la primera
    // no se atiende y queda colgada. Con 0, cada conexión lleva una consulta a la vez
    // y las consultas en paralelo se reparten entre conexiones.
    // Consecuencia: sql.begin() no funciona con esta opción; usar transaccion() de abajo.
    // (opción válida de postgres.js 3.4, ausente en sus tipos)
    ...({ max_pipeline: 0 } as {}),
    max: process.env.NODE_ENV === "production" ? 4 : 5,
    idle_timeout: INACTIVIDAD_S,
    // Fallar rápido (y mostrar el motivo) en vez de dejar la pantalla esperando.
    connect_timeout: 8,
    max_lifetime: 60 * 5,
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
type Estado = { cliente: Sql | null; ultimoUso: number };
const g = globalThis as unknown as { __db?: Estado };
const estado: Estado = g.__db ?? (g.__db = { cliente: null, ultimoUso: 0 });

function cliente(): Sql {
  return estado.cliente ?? (estado.cliente = crear());
}

// --- Capa 1: no congelar la función con conexiones abiertas -------------------
let liberar: (() => void) | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function mantenerVivaHastaCerrarConexiones() {
  if (!process.env.VERCEL) return;
  if (temporizador) {
    clearTimeout(temporizador);
    liberar?.();
  }
  const espera = new Promise<void>((resolver) => {
    liberar = resolver;
    temporizador = setTimeout(resolver, INACTIVIDAD_S * 1000 + 250);
  });
  try {
    waitUntil(espera);
  } catch {
    // Fuera del contexto de un request (por ejemplo, durante el build): no hace falta.
  }
}

function usar(): Sql {
  mantenerVivaHastaCerrarConexiones();
  return cliente();
}

/** Cliente SQL. Delegamos en el cliente vigente para poder recrearlo si queda inservible. */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args: unknown[]) => (usar() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = usar() as unknown as Record<PropertyKey, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

// --- Capa 2: verificar el cliente antes de usarlo tras un período inactivo ----
// Cada request llama a asegurarConexion() ANTES de su primera consulta (lo hace
// obtenerSesion, que usan todas las pantallas y acciones). Las llamadas
// concurrentes comparten la misma verificación.
let verificando: Promise<void> | null = null;

export function asegurarConexion(): Promise<void> {
  if (!estado.cliente || Date.now() - estado.ultimoUso < VERIFICAR_SI_INACTIVO_MS) {
    estado.ultimoUso = Date.now();
    return Promise.resolve();
  }
  return (verificando ??= verificar().finally(() => { verificando = null; }));
}

async function verificar() {
  const actual = estado.cliente!;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const responde = await Promise.race([
    actual`select 1`.then(() => true, () => false),
    new Promise<boolean>((r) => { espera = setTimeout(() => r(false), LIMITE_VERIFICACION_MS); }),
  ]);
  clearTimeout(espera);
  if (!responde && estado.cliente === actual) {
    console.warn("La conexión a la base no respondió; se recrea el cliente.");
    estado.cliente = crear();
    actual.end({ timeout: 0 }).catch(() => {});
  }
  estado.ultimoUso = Date.now();
}

// --- Transacciones -------------------------------------------------------------
type Reservada = Awaited<ReturnType<Sql["reserve"]>>;

/**
 * Transacción sobre una conexión reservada (BEGIN/COMMIT/ROLLBACK explícitos).
 * Reemplaza a sql.begin(), que con max_pipeline: 0 falla con UNSAFE_TRANSACTION.
 */
export async function transaccion<T>(fn: (tx: Reservada) => Promise<T>): Promise<T> {
  const tx = await sql.reserve();
  try {
    await tx`begin`;
    const resultado = await fn(tx);
    await tx`commit`;
    return resultado;
  } catch (e) {
    await tx`rollback`.catch(() => {});
    throw e;
  } finally {
    tx.release();
  }
}
