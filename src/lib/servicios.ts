// Tipo de servicio de cada SGR (ver migración 20261019000000_servicios.sql).
export const SERVICIOS: Record<string, { nombre: string; corto: string; clase: string }> = {
  desa_test: { nombre: "Desarrollo con testing", corto: "Desarrollo + testing", clase: "e-desa" },
  solo_desa: { nombre: "Desarrollo sin testing", corto: "Solo desarrollo", clase: "e-desa" },
  solo_test: { nombre: "Solo testing (desarrollo del cliente)", corto: "Solo testing", clase: "e-test" },
  sin_servicio: { nombre: "Sin horas presupuestadas", corto: "Sin servicio", clase: "e-neutro" },
};

export const ORDEN_SERVICIOS = ["desa_test", "solo_desa", "solo_test", "sin_servicio"];

export function nombreServicio(c: string | null | undefined) {
  return (c && SERVICIOS[c]?.nombre) || c || "Sin dato";
}
export function claseServicio(c: string | null | undefined) {
  return (c && SERVICIOS[c]?.clase) || "e-neutro";
}
