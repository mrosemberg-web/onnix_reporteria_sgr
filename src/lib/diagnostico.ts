// Traduce errores de conexión/configuración a mensajes accionables (sin exponer secretos).

type ErrorPg = { code?: string; errno?: string; message?: string };

export function describirError(e: unknown): { codigo: string; mensaje: string } {
  const err = (e ?? {}) as ErrorPg;
  const codigo = err.code || err.errno || "DESCONOCIDO";
  const msg = String(err.message ?? "");

  if (msg.includes("Falta DATABASE_URL")) {
    return { codigo: "SIN_DATABASE_URL", mensaje: "Falta la variable DATABASE_URL en el servidor." };
  }
  if (msg.includes("AUTH_SECRET")) {
    return { codigo: "AUTH_SECRET", mensaje: "AUTH_SECRET no está definida o tiene menos de 32 caracteres." };
  }
  if (codigo === "28P01") {
    return { codigo, mensaje: "La base rechazó la clave de DATABASE_URL. Revisá la clave de la base de datos de Supabase." };
  }
  if (/tenant or user not found/i.test(msg)) {
    return { codigo: "TENANT", mensaje: "El pooler no reconoce el usuario: en DATABASE_URL debe ser postgres.<ref-del-proyecto>, no solo postgres." };
  }
  if (["CONNECT_TIMEOUT", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "ECONNREFUSED"].includes(codigo)) {
    return { codigo, mensaje: "No se pudo conectar con la base. Verificá que DATABASE_URL use el Transaction pooler (host …pooler.supabase.com, puerto 6543); la conexión directa db.<ref>.supabase.co no funciona desde Vercel." };
  }
  if (codigo === "ENOTFOUND") {
    return { codigo, mensaje: "El host de DATABASE_URL no existe. Copiá de nuevo la cadena desde Connect › Transaction pooler." };
  }
  if (codigo === "42P01") {
    return { codigo, mensaje: "Faltan las tablas: ejecutá las migraciones de supabase/migrations en el SQL Editor." };
  }
  if (/invalid url|invalid connection/i.test(msg)) {
    return { codigo: "URL_INVALIDA", mensaje: "DATABASE_URL tiene un formato inválido (¿comillas o caracteres especiales sin codificar en la clave?)." };
  }
  return { codigo, mensaje: "Error inesperado del servidor." };
}
