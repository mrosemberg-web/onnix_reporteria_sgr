// Estados del SGR según el sistema de gestión del cliente.
export const ESTADOS: Record<string, { nombre: string; clase: string; entregado: boolean }> = {
  PRO: { nombre: "Finalizado en producción", clase: "e-bien", entregado: true },
  PAP: { nombre: "Pase a producción", clase: "e-desa", entregado: true },
  DST: { nombre: "Desestimado por el cliente", clase: "e-neutro", entregado: false },
};

export function nombreEstado(codigo: string | null | undefined) {
  if (!codigo) return "Sin estado";
  return ESTADOS[codigo.trim().toUpperCase()]?.nombre ?? codigo;
}

export function claseEstado(codigo: string | null | undefined) {
  return (codigo && ESTADOS[codigo.trim().toUpperCase()]?.clase) || "e-neutro";
}
